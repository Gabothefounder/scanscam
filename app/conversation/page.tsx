import type { Metadata } from "next";
import ConversationLanding from "@/components/ConversationLanding";
import { CONVERSATION_COPY } from "@/lib/conversation/copy";

export const metadata: Metadata = {
  title: CONVERSATION_COPY.en.metaTitle,
  description: CONVERSATION_COPY.en.metaDescription,
};

export default function ConversationPage() {
  return <ConversationLanding lang="en" />;
}
