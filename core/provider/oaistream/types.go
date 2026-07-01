package oaistream

import "github.com/enowdev/enowx/core/model"

type usageBlock struct {
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	Credit           float64 `json:"credit"`
}

// toolCallChunk is one streamed tool_call fragment in an OpenAI delta.
type toolCallChunk struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type chatChunk struct {
	Model   string `json:"model"`
	Choices []struct {
		Delta struct {
			Content   string          `json:"content"`
			ToolCalls []toolCallChunk `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage *usageBlock `json:"usage"`
}

func (c chatChunk) delta() string {
	if len(c.Choices) == 0 {
		return ""
	}
	return c.Choices[0].Delta.Content
}

// toolCalls converts any streamed tool_call fragments to model.ToolCallDelta.
func (c chatChunk) toolCalls() []model.ToolCallDelta {
	if len(c.Choices) == 0 || len(c.Choices[0].Delta.ToolCalls) == 0 {
		return nil
	}
	out := make([]model.ToolCallDelta, 0, len(c.Choices[0].Delta.ToolCalls))
	for _, t := range c.Choices[0].Delta.ToolCalls {
		out = append(out, model.ToolCallDelta{Index: t.Index, ID: t.ID, Name: t.Function.Name, ArgsDelta: t.Function.Arguments})
	}
	return out
}

func (c chatChunk) finishReason() string {
	if len(c.Choices) == 0 {
		return ""
	}
	return c.Choices[0].FinishReason
}

// usage returns the usage block as a model.Usage, or nil if absent/empty.
func (c chatChunk) usage() *model.Usage {
	if c.Usage == nil {
		return nil
	}
	if c.Usage.PromptTokens == 0 && c.Usage.CompletionTokens == 0 && c.Usage.Credit == 0 {
		return nil
	}
	return &model.Usage{
		PromptTokens:     c.Usage.PromptTokens,
		CompletionTokens: c.Usage.CompletionTokens,
		Credit:           c.Usage.Credit,
	}
}

type chatResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message struct {
			Content   string          `json:"content"`
			ToolCalls []toolCallChunk `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

func (c chatResponse) text() string {
	if len(c.Choices) == 0 {
		return ""
	}
	return c.Choices[0].Message.Content
}

func (c chatResponse) toolCalls() []model.ToolCallDelta {
	if len(c.Choices) == 0 || len(c.Choices[0].Message.ToolCalls) == 0 {
		return nil
	}
	out := make([]model.ToolCallDelta, 0, len(c.Choices[0].Message.ToolCalls))
	for _, t := range c.Choices[0].Message.ToolCalls {
		out = append(out, model.ToolCallDelta{Index: t.Index, ID: t.ID, Name: t.Function.Name, ArgsDelta: t.Function.Arguments})
	}
	return out
}

func (c chatResponse) finishReason() string {
	if len(c.Choices) == 0 {
		return ""
	}
	return c.Choices[0].FinishReason
}
