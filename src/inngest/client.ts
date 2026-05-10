import { Inngest } from "inngest"

export const inngest = new Inngest({
  id:  "postflow",
  name: "PostFlow",
  // eventKey is read from INNGEST_EVENT_KEY at runtime
})
