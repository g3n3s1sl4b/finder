import { useState, useEffect } from "react";
import apiClient from "../apiClient";
import { fcdUrl, getNetwork } from "../scripts/utility";

interface IFetch {
  url: string;
  params?: object;
  network: string;
}
export default ({ url, params, network }: IFetch) => {
  const [data, setData] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState();

  const fcd = fcdUrl(getNetwork());

  const init = (): void => {
    setError(undefined);
    setIsLoading(true);
  };
  useEffect(() => {
    const fetchData = async () => {
      init();

      try {
        const result = await apiClient.get(fcd + url, { params });
        setData(result.data);
      } catch (error) {
        setError(error);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [params, url, network, fcd]);

  return { data, isLoading, error };
};