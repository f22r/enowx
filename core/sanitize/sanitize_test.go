package sanitize

import "testing"

func TestRoundTrip(t *testing.T) {
	SetRules([]Rule{{Pattern: "enowx", Replacement: "acme"}})
	if got := Obfuscate("hi enowx there"); got != "hi acme there" {
		t.Fatalf("obfuscate: %q", got)
	}
	if got := Deobfuscate("reply from acme"); got != "reply from enowx" {
		t.Fatalf("deobfuscate: %q", got)
	}
}

func TestReverseSkips(t *testing.T) {
	// Short/empty/identical replacements must not reverse (over-match guard).
	SetRules([]Rule{
		{Pattern: "foobar", Replacement: "x"},   // <3 → no reverse
		{Pattern: "baz", Replacement: ""},        // empty → deletion, no reverse
		{Pattern: "same", Replacement: "same"},   // identical → dropped entirely
	})
	if got := Deobfuscate("x same"); got != "x same" {
		t.Fatalf("unexpected reverse: %q", got)
	}
	// Forward still deletes/obfuscates.
	if got := Obfuscate("baz"); got != "" {
		t.Fatalf("obfuscate delete: %q", got)
	}
}

func TestInactive(t *testing.T) {
	SetRules(nil)
	if Active() {
		t.Fatal("should be inactive")
	}
	if Obfuscate("anything") != "anything" {
		t.Fatal("no-op expected")
	}
}
