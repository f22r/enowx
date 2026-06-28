package main

import (
	"log"
	"time"

	"github.com/enowdev/enowx/config"
	"github.com/enowdev/enowx/core/pool"
	"github.com/enowdev/enowx/core/provider"
	"github.com/enowdev/enowx/core/provider/openaicompat"
	"github.com/enowdev/enowx/core/proxy"
	"github.com/enowdev/enowx/core/transport"
	"github.com/enowdev/enowx/server"
	"github.com/enowdev/enowx/store/sqlite"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := sqlite.Open(cfg.DBPath())
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer db.Close()

	reg := provider.NewRegistry()
	reg.Register(openaicompat.New("openai", "https://api.openai.com/v1"))

	px := proxy.New(reg, pool.New(db.Accounts()), transport.NewStandard(5*time.Minute))

	srv := server.New(cfg.Addr(), server.Deps{
		Proxy: px,
		Route: func(string) string { return "openai" }, // slice-0: single provider
	})

	log.Printf("enowx listening on %s", cfg.Addr())
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
