import { utimes } from "fs";
import { route } from "next/dist/next-server/server/router";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useMeQuery, useCreatePostMutation } from "../generated/graphql";

export const useIsAuth = () => {
  const [{data, fetching}] = useMeQuery();
  const [, createPost] = useCreatePostMutation();
  const router = useRouter()
  useEffect(() => {
    if (!fetching && !data?.me){
      router.replace("/login?next=" + router.pathname)
    }
  }, [fetching, data, router])
}