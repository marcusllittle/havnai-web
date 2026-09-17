import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ query }) => ({
  redirect: {
    destination: typeof query.workflow === "string" ? `/create?workflow=${encodeURIComponent(query.workflow)}` : "/create",
    permanent: true,
  },
});

export default function GeneratorRedirectPage() {
  return null;
}
