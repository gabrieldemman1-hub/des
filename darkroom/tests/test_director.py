"""Unit tests for the prompt director (rules + LLM text cleanup)."""
import pytest

from director import LocalLLM, _clean_llm_text, _segments, beats_for, blocked_term, compose, words_for


def test_blocked_terms_whole_words_only():
    assert blocked_term("a teen girl") == "teen"
    assert blocked_term("two kids") == "kid"
    assert blocked_term("Minority report") is None
    assert blocked_term("kidney stones") is None
    assert blocked_term("a woman in her thirties") is None


def test_segments_split_on_sequence_words_but_not_inside_quotes():
    assert _segments("she walks in, then sits down. Finally she smiles") == ["she walks in", "sits down", "she smiles"]
    assert _segments('she says "wait, then go" and waves') == ['she says "wait, then go" and waves']


def test_beats_and_words_scale_with_duration():
    assert beats_for(3) == 1 and beats_for(5) == 1 and beats_for(8) == 2 and beats_for(15) == 3 and beats_for(30) == 5
    assert words_for(5) == (40, 90) and words_for(10) == (80, 150) and words_for(30)[1] == 390


def test_compose_wan3_keeps_user_words_and_adds_structure():
    c = compose("she slowly turns toward the camera and smiles, then walks to the window", has_image=True, duration_s=5, audio=False, style="none", target="wan3")
    p = c.prompt
    assert p.startswith("5 seconds, one continuous shot.")
    assert "Keep the photoreal look of the first frame" in p
    assert "turns toward the camera and smiles, then walks to the window" in p   # one beat for a 5 s clip, order kept
    assert "fixed camera, position unchanged" in p                               # "toward the camera" is not a camera instruction
    assert "Lighting unchanged." in p and "window, natural colour" not in p       # image sets the light
    assert "No dialogue" not in p and "music" not in p                            # audio off: nothing about sound
    assert p.endswith("no slow motion.") and "Negative prompt list:" in p
    assert c.source == "rules" and c.beats == 1


def test_compose_wan3_timestamps_dialogue_and_user_camera():
    c = compose('a woman in a red dress dancing in a dim bar. "come closer". neon light, slow dolly in', has_image=False, duration_s=10, audio=True, style="cinematic", target="wan3")
    p = c.prompt
    assert "(0-5s) A woman in a red dress dancing in a dim bar." in p
    assert "(5-10s) The movement continues" in p                   # the quoted line is dialogue, not a beat
    assert 'She says in a soft, unhurried voice: "come closer". Lip sync.' in p
    assert "Neon light, slow dolly in." in p
    assert "camera pushes in" not in p and "Warm key light" not in p   # user covered camera and light
    assert "Sound effects:" in p and "No background music." in p
    assert "35mm cinematic film look" in p
    assert any("2 motion beats" in n for n in c.notes)


def test_compose_wan3_without_text_adds_idle_motion_and_silence_lines():
    c = compose("", has_image=True, duration_s=8, audio=True, style="glamour", target="wan3")
    assert "subtle, continuous motion" in c.prompt and "orbits slowly about 30 degrees" in c.prompt
    assert "No dialogue." in c.prompt and "No background music." in c.prompt
    assert any("idle motion" in n for n in c.notes)


def test_compose_wan_local_is_short_and_silent():
    c = compose('she turns and smiles, then waves. "hi there"', has_image=True, duration_s=5, audio=True, style="none", target="wan")
    p = c.prompt
    assert not p.startswith("5 seconds")                     # no overall line for local 2.x presets
    assert "Negative prompt list" not in p and "No dialogue" not in p and "says" not in p
    assert "turns and smiles, then waves" in p and "fixed camera" in p
    assert any("Sound is off" in n for n in c.notes)


def test_compose_image_targets():
    nat = compose("portrait of a woman, red lips, freckles", duration_s=5, style="photoreal", target="image")
    assert nat.beats == 0
    assert nat.prompt.startswith("Portrait of a woman, red lips, freckles.") and "85mm" in nat.prompt and "motion" not in nat.prompt
    tags = compose("portrait of a woman, red lips, freckles, cinematic", style="photoreal", target="sdxl")
    assert tags.prompt.startswith("portrait of a woman, red lips, freckles, cinematic, ")
    assert "raw photo" not in tags.prompt              # "cinematic" already sets a style
    assert tags.prompt.count("85mm lens") == 1


def test_compose_unknown_style_falls_back_to_none():
    assert compose("a cat", style="does-not-exist").prompt


def test_clean_llm_text():
    assert _clean_llm_text("<think>hmm</think>\n\"A woman walks.\"") == "A woman walks."
    assert _clean_llm_text("```\nPrompt: A woman\nwalks.\n```") == "A woman walks."
    assert _clean_llm_text('She says "hi" and he says "yo".') == 'She says "hi" and he says "yo".'


def test_local_llm_refuses_remote_urls_by_default():
    with pytest.raises(ValueError):
        LocalLLM("http://192.168.1.20:11434/v1")
    LocalLLM("http://192.168.1.20:11434/v1", allow_remote=True)
    LocalLLM("http://localhost:1234/v1")
    LocalLLM("http://[::1]:8080/v1")


def test_camera_phrase_detection():
    from director import CAMERA_RE
    assert CAMERA_RE.search("the camera pushes in slowly")
    assert CAMERA_RE.search("fixed camera, no movement")
    assert CAMERA_RE.search("slow dolly in")
    assert not CAMERA_RE.search("she looks at the camera and smiles")


def test_system_prompt_variants():
    from director import system_prompt_for
    s = system_prompt_for("wan3", duration_s=10, audio=True, has_image=True, style="glamour")
    assert "10 seconds" in s and "2 beat(s)" in s and "Negative prompt list" in s and "Lip sync" in s and "first frame unchanged" in s
    s = system_prompt_for("wan", duration_s=5, audio=True, has_image=False, style="none")
    assert "WITHOUT sound" in s and "No negative list" in s
    assert "comma-separated" in system_prompt_for("sdxl", duration_s=5, audio=False, has_image=False, style="none")
    assert "still-image" in system_prompt_for("image", duration_s=5, audio=False, has_image=False, style="none")
