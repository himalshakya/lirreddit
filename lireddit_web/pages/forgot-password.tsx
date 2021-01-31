import { Wrapper } from "../components/Wrapper";
import { InputField } from "../components/InputField";
import { Formik, Form } from "formik";
import { Button } from "@chakra-ui/react";
import { useForgotPasswordMutation } from "../generated/graphql";
import { withUrqlClient } from "next-urql";
import { createUrqlClient } from "../utils/createUrqlClient";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { useToast } from "@chakra-ui/react";

const ForgotPassword: React.FC<{}> = ({}) => {
  const router = useRouter();
  const [, setComplete] = useState(false);
  const [, forgotPassword] = useForgotPasswordMutation();
  const toast = useToast();

  return (
    <Wrapper variant="small">
      <Formik
        initialValues={{ email: "" }}
        onSubmit={async ({ email }) => {
          console.log("Submitting.....");
          await forgotPassword({ email });
          setComplete(true);
          toast({
            title: "Email Sent",
            description:
              "An email to reset password has been sent if the email is valid",
            status: "success",
            duration: 9000,
            isClosable: true,
          });
          router.push("/");
        }}
      >
        {({ isSubmitting }) => (
          <Form>
            <InputField
              name="email"
              placeholder="Email"
              label="Email"
              type="email"
            />
            <Button
              mt={4}
              type="submit"
              isLoading={isSubmitting}
              colorScheme="teal"
              variant="solid"
            >
              Change Password
            </Button>
          </Form>
        )}
      </Formik>
    </Wrapper>
  );
};

export default withUrqlClient(createUrqlClient)(ForgotPassword);
