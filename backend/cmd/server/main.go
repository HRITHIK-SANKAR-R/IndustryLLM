package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"omnigraph/internal/ai"
	"omnigraph/internal/pipeline"
	"omnigraph/internal/router"
	"omnigraph/internal/store"
	"omnigraph/internal/worker"
)

func main() {
	port := getenv("PORT", "8080")
	mockDir := getenv("MOCK_DIR", "mock_data")

	groqKey := os.Getenv("GROQ_API_KEY")
	nvidiaKey := os.Getenv("NVIDIA_API_KEY")
	forceMock := os.Getenv("MOCK_MODE") == "true"
	hasKeys := groqKey != "" && nvidiaKey != "" && !forceMock

	st := store.New()
	wk := worker.New(worker.BaseURLFromEnv())
	aiClient := ai.New(groqKey, nvidiaKey)

	pl := &pipeline.Pipeline{
		Store:   st,
		Worker:  wk,
		AI:      aiClient,
		MockDir: mockDir,
		HasKeys: hasKeys,
	}

	rt := &router.Router{
		Store:    st,
		Pipeline: pl,
		Worker:   wk,
		MockOnly: !hasKeys,
	}

	mode := "LIVE (Groq + NVIDIA)"
	if !hasKeys {
		mode = "MOCK (no API keys / MOCK_MODE=true → Golden Dataset)"
	}
	fmt.Printf("OMNI-GRAPH router :%s  mode=%s\n", port, mode)

	if err := http.ListenAndServe(":"+port, rt.Handler()); err != nil {
		log.Fatal(err)
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
