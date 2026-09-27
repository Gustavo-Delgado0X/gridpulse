import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceAgent } from "../components/VoiceAgent";
import { OPPS, QUALITY } from "./fixtures";

type Options = {
  signedUrl: string;
  clientTools: Record<string, (p: Record<string, unknown>) => Promise<string>>;
  onMessage: (m: { message: string; role: "user" | "agent" }) => void;
  onModeChange: (m: { mode: "speaking" | "listening" }) => void;
  onStatusChange: (s: { status: string }) => void;
};
const session = { endSession: vi.fn(() => Promise.resolve()) };
let captured: Options | null = null;

vi.mock("@elevenlabs/client", () => ({
  VoiceConversation: { startSession: vi.fn(async (options: Options) => { captured = options; return session; }) },
}));

const DETAIL = { ...OPPS[1], project_a: {}, project_b: {}, estimator: {}, maps_links: {}, evidence: [
  { id: "a.in_service_date", type: "fact", label: "FACT", field: "in_service_date", quote: "12/31/25", page: 23,
    source_id: "desc-2428", project_id: "desc-3" }] };
const RESPONSES: Record<string, unknown> = {
  "/api/voice/session": { signed_url: "wss://signed" },
  "/api/opportunities": OPPS,
  [`/api/opportunities/${OPPS[1].id}`]: DETAIL,
  "/api/changes": [],
  "/api/quality": QUALITY,
};

beforeEach(() => {
  captured = null;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const data = RESPONSES[decodeURIComponent(url.split("?")[0])];
    return new Response(JSON.stringify({ data, error: null, meta: {} }), { status: data === undefined ? 404 : 200 });
  }));
});

async function start(onShow = vi.fn()) {
  render(<VoiceAgent onShow={onShow} />);
  await userEvent.click(screen.getByRole("button", { name: "Talk to the GridPulse analyst" }));
  await vi.waitFor(() => expect(captured).not.toBeNull());
  return onShow;
}

test("starts a session with the signed URL from our server and shows the transcript", async () => {
  await start();
  expect(captured!.signedUrl).toBe("wss://signed");
  act(() => {
    captured!.onStatusChange({ status: "connected" });
    captured!.onMessage({ role: "user", message: "What should DESC look at first?" });
    captured!.onMessage({ role: "agent", message: "Pair one is a T one: the two projects touch at Thurmond." });
    captured!.onModeChange({ mode: "speaking" });
  });
  const log = screen.getByRole("log", { name: "Conversation" });
  expect(log).toHaveTextContent("What should DESC look at first?");
  expect(log).toHaveTextContent("Pair one is a T one");
  expect(screen.getByText("Speaking")).toBeInTheDocument();
});

test("client tools answer from the live API, cite pages, and open pairs on screen", async () => {
  const onShow = await start();
  const tools = captured!.clientTools;
  expect(Object.keys(tools).sort()).toEqual(["get_data_quality", "get_opportunity", "get_plan_changes", "get_study_summary",
    "list_opportunities", "show_opportunity"]);

  const facts = JSON.parse(await tools.get_opportunity({ rank: 2 }));
  expect(facts.source_facts[0].source).toBe("desc-2428 page 23");

  expect(await tools.show_opportunity({ rank: 2 })).toMatch(/Opened pair 2/);
  expect(onShow).toHaveBeenCalledWith(OPPS[1].id);

  expect(await tools.get_opportunity({ rank: 99 })).toMatch(/No pair with rank 99/);
  expect(JSON.parse(await tools.get_study_summary({})).pairs_within_25_mi).toBe(OPPS.length);
});

test("End closes the session", async () => {
  await start();
  act(() => captured!.onStatusChange({ status: "connected" }));
  await userEvent.click(screen.getByRole("button", { name: "End conversation" }));
  expect(session.endSession).toHaveBeenCalled();
});

test("a session failure is explained", async () => {
  RESPONSES["/api/voice/session"] = undefined;
  render(<VoiceAgent onShow={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Talk to the GridPulse analyst" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not start the voice analyst");
  RESPONSES["/api/voice/session"] = { signed_url: "wss://signed" };
});
