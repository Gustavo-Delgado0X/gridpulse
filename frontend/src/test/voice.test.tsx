import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceBrief } from "../components/VoiceBrief";

const AUDIO_URL = "/api/opportunities/desc-1__gpc-1/brief/audio?method=closest";
const SCRIPT = "GridPulse briefing. Pair 1 in the Savannah and Augusta study. Tier T1: must coordinate.";

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    queueMicrotask(() => this.dispatchEvent(new Event("playing")));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => vi.restoreAllMocks());

const audio = () => document.querySelector("audio")!;

test("Listen plays the ElevenLabs briefing for this pair, then pauses and resumes", async () => {
  render(<VoiceBrief audioUrl={AUDIO_URL} loadScript={() => Promise.resolve(SCRIPT)} />);
  await userEvent.click(screen.getByRole("button", { name: "Listen to voice briefing" }));
  expect(audio()).toHaveAttribute("src", AUDIO_URL);
  expect(await screen.findByRole("button", { name: "Pause voice briefing" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Pause voice briefing" }));
  expect(screen.getByRole("button", { name: "Resume voice briefing" })).toBeInTheDocument();

  act(() => { audio().dispatchEvent(new Event("ended")); });
  expect(screen.getByRole("button", { name: "Listen to voice briefing" })).toBeInTheDocument();
});

test("the transcript shows exactly what the voice says", async () => {
  const loadScript = vi.fn(() => Promise.resolve(SCRIPT));
  render(<VoiceBrief audioUrl={AUDIO_URL} loadScript={loadScript} />);
  expect(loadScript).not.toHaveBeenCalled(); // loaded only when asked for
  await userEvent.click(screen.getByText("Transcript"));
  expect(await screen.findByText(SCRIPT)).toBeInTheDocument();
});

test("an audio failure is explained and can be retried", async () => {
  render(<VoiceBrief audioUrl={AUDIO_URL} loadScript={() => Promise.resolve(SCRIPT)} />);
  await userEvent.click(screen.getByRole("button", { name: "Listen to voice briefing" }));
  act(() => { fireEvent.error(audio()); });
  expect(screen.getByRole("status")).toHaveTextContent("Voice briefing could not load");
  expect(screen.getByRole("button", { name: "Retry voice briefing" })).toBeInTheDocument();
});
