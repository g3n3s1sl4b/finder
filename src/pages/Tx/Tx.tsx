import { useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { useParams } from "react-router-dom";
import { get, last, isEmpty } from "lodash";
import c from "classnames";
import {
  getTxAllCanonicalMsgs,
  createLogMatcherForActions
} from "@terra-money/log-finder-ruleset";
import { formatDistanceToNowStrict } from "date-fns";
import apiClient from "../../apiClient";
import Finder from "../../components/Finder";
import MsgBox from "../../components/MsgBox";
import Copy from "../../components/Copy";
import Icon from "../../components/Icon";
import { useLogfinderActionRuleSet } from "../../hooks/useLogfinder";
import { useCurrentChain, useFCDURL } from "../../contexts/ChainsContext";
import format from "../../scripts/format";
import Pending from "./Pending";
import Searching from "./Searching";
import TxAmount from "./TxAmount";
import TxTax from "./TxTax";
import s from "./Tx.module.scss";

type Coin = {
  amount: string;
  denom: string;
};

const TxComponent = ({ hash }: { hash: string }) => {
  const ruleSet = useLogfinderActionRuleSet();
  const logMatcher = useMemo(
    () => createLogMatcherForActions(ruleSet),
    [ruleSet]
  );
  const { data: response, progressState } = usePollTxHash(hash);

  if (!response) {
    return <Searching state={progressState} hash={hash} />;
  }

  const isPending = !response?.height;
  const matchedMsg = getTxAllCanonicalMsgs(
    JSON.stringify(response),
    logMatcher
  );

  const fee: Coin[] = get(response, "tx.value.fee.amount");
  const tax: string[] = response.logs
    ?.map(log => get(log, "log.tax"))
    .filter(data => typeof data === "string" && data !== "")
    .flat();

  // status settings
  const status = isPending ? (
    <span className={c(s.status, s.pending)}>Pending</span>
  ) : !response.code ? (
    <span className={c(s.status, s.success)}>Success</span>
  ) : (
    <span className={c(s.status, s.fail)}>Failed</span>
  );

  return (
    <>
      <h2 className={s.title}>Transaction Details</h2>
      <div className={s.header}>
        {status}
        <span className={c(s.date, s.sideLine)}>
          {formatDistanceToNowStrict(new Date(response.timestamp.toString()), {
            addSuffix: true
          })}
        </span>
        <span className={c(s.date, s.txTime)}>
          {format.date(response.timestamp.toString())}
        </span>
      </div>

      {isPending && <Pending timestamp={response.timestamp} />}
      {response.code && (
        <div className={s.failedMsg}>
          <Icon name="error" size={18} className={s.icon} />
          <p>
            {get(last(response.logs), "log.message") ||
              get(response, "raw_log")}
          </p>
        </div>
      )}

      <div className={s.list}>
        <div className={s.row}>
          <div className={s.head}>Tx Hash</div>
          <div className={s.body}>
            <div>
              {response.txhash}
              <Copy
                text={response.txhash}
                style={{ display: "inline-block", position: "absolute" }}
              />
            </div>
          </div>
        </div>

        <div className={s.row}>
          <div className={s.head}>Network</div>
          <div className={s.body}>{response.chainId}</div>
        </div>

        {isPending ? (
          <></>
        ) : (
          <div className={s.row}>
            <div className={s.head}>Block</div>
            <div className={s.body}>
              <Finder q="blocks" v={response.height}>
                {response.height}
              </Finder>
            </div>
          </div>
        )}

        {fee?.length ? (
          <div className={s.row}>
            <div className={s.head}>Transaction fee</div>
            <div className={s.body}>
              {fee.map((fee, key) => (
                <TxAmount index={key} {...fee} key={key} />
              ))}
            </div>
          </div>
        ) : (
          <></>
        )}

        {!isEmpty(tax) && (
          <div className={s.row}>
            <div className={s.head}>Tax</div>
            <div className={s.body}>
              <TxTax tax={tax} />
            </div>
          </div>
        )}

        {!isPending && (
          <div className={s.row}>
            <div className={s.head}>Gas (Used/Requested)</div>
            <div className={s.body}>
              {parseInt(response.gas_used).toLocaleString()}/
              {parseInt(response.gas_wanted).toLocaleString()}
            </div>
          </div>
        )}

        <div className={s.row}>
          <div className={s.head}>Memo</div>
          <div className={s.body}>
            {response.tx.value.memo ? response.tx.value.memo : "-"}
          </div>
        </div>
      </div>

      {response.tx.value.msg.map((msg, index) => {
        const msgInfo = matchedMsg?.[index];

        return (
          <MsgBox
            msg={msg}
            log={response.logs?.[index]}
            info={msgInfo}
            key={index}
          />
        );
      })}
    </>
  );
};

const Tx = () => {
  const { hash } = useParams();
  if (!hash) {
    throw new Error("Tx hash is not defined");
  }

  return hash ? <TxComponent hash={hash} key={hash} /> : null;
};

export default Tx;

/* hooks */
const INTERVAL = 1000;

const usePollTxHash = (txhash: string) => {
  const { chainID } = useCurrentChain();
  const fcdURL = useFCDURL();

  const [stored, setStored] = useState<TxResponse>();
  const [progress, setProgress] = useState<number>(0);

  /* polling tx */
  const [refetchTx, setRefetchTx] = useState<boolean>(true);

  /* polling mempool tx */
  const [refetchMempool, setRefetchMempool] = useState<boolean>(false);

  /* query: tx */
  const txQuery = useQuery(
    [chainID, txhash, "tx"],
    () => apiClient.get<TxResponse>(fcdURL + `/v1/tx/${txhash}`),
    {
      refetchInterval: INTERVAL,
      refetchOnWindowFocus: false,
      enabled: refetchTx,
      onSuccess: data => data.data && setStored(data.data)
    }
  );

  /* query: mempool tx */
  const mempoolQuery = useQuery(
    [chainID, txhash, "mempool"],
    () => apiClient.get<TxResponse>(fcdURL + `/v1/mempool/${txhash}`),
    {
      refetchInterval: INTERVAL,
      refetchOnWindowFocus: false,
      enabled: refetchMempool,
      onSuccess: data => data.data && setStored(data.data)
    }
  );

  // if tx not exists(null or no height), start polling mempool tx
  useEffect(() => {
    if (txQuery.data?.data) {
      setRefetchTx(false);
      setRefetchMempool(false);
    }

    if (!txQuery.isFetching && !txQuery.data?.data) {
      setRefetchMempool(true);
    }

    if (mempoolQuery.data?.data) {
      setRefetchMempool(false);
    }

    setProgress(state => (state + 0.0333) % 1);
  }, [mempoolQuery.data, txQuery.data, txQuery.isFetching, txhash]);

  return {
    data: stored,
    progressState: progress
  };
};
