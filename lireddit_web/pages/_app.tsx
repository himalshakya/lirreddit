import { ChakraProvider } from "@chakra-ui/react";
import "../styles/globals.css";

function MyApp({ Component, pageProps }: any) {
  return (
      <ChakraProvider>
        <Component {...pageProps} />
      </ChakraProvider>
  );
}

export default MyApp;
