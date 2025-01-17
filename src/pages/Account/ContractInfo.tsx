import {
  useContracts,
  useNFTContracts,
  useWhitelist
} from "../../hooks/useTerraAssets";
import WithFetch from "../../HOCs/WithFetch";
import Loading from "../../components/Loading";
import Image from "../../components/Image";
import s from "./ContractInfo.module.scss";

const ContractInfo = ({ address }: { address: string }) => {
  const token = useWhitelist()?.[address];
  const nft = useNFTContracts()?.[address];
  const contract = useContracts()?.[address];

  const whitelist = token || contract || nft;
  const icon = whitelist?.icon;

  return whitelist ? (
    <section className={s.wrapper}>
      <Image url={icon} className={s.icon} />
      {token ? (
        <span className={s.name}>
          {`${token.protocol} ${token.symbol} Token `}
          <span className={s.vertical} />
          <span className={s.symbol}>{token.symbol}</span>
        </span>
      ) : (
        <span className={s.name}>
          {nft?.name || `${contract?.protocol} ${contract?.name}`}
        </span>
      )}
    </section>
  ) : (
    <WithFetch
      url={`/wasm/contracts/${address}/store?query_msg={"token_info":{}}`}
      loading={<Loading />}
      renderError={() => null}
    >
      {({ result: { name, symbol } }) => (
        <section className={s.wrapper}>
          <span className={s.name}>
            {name}
            <span className={s.vertical} />
            <span className={s.symbol}>{symbol}</span>
          </span>
        </section>
      )}
    </WithFetch>
  );
};

export default ContractInfo;
