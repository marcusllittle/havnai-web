import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/create",
    permanent: true,
  },
});

export default function GeneratorRedirectPage() {
  return null;
}
