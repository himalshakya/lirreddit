import { withUrqlClient } from "next-urql";
import React from "react";
import { NavBar } from "../components/NavBar";
import { usePostsQuery } from "../generated/graphql";
import { createUrqlClient } from "../utils/createUrqlClient";

const Index = () => {
    const [{data}] = usePostsQuery()
  return (
    <React.Fragment>
      <NavBar />
      <div>hello world</div>
      <br />
      {!data? <div>loading...</div> : data.posts.map((p) => <div key={p.id}>{p.title}</div>)}
    </React.Fragment>
  );
};

export default withUrqlClient(createUrqlClient, {ssr: true})(Index);