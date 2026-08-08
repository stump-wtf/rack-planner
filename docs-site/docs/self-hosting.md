---
sidebar_position: 5
title: self-hosting
---

# self-hosting

The app is static files. Any web server will do — but serve `.js` as JavaScript
or the browser will refuse the modules.

## docker

```bash
docker run -p 8080:8080 gitea.stump.rocks/stump.wtf/rack-planner:latest
```

The image is nginx-unprivileged with the static files and a small config. It
runs as uid 101, listens on 8080, and exposes `/healthz`.

:::warning don't cache these assets forever
The assets are **not** content-hashed — this ships as plain ES modules with
stable filenames. A long immutable cache pins a stale stylesheet, which is
exactly the bug that bit `apps.stump.wtf`. The bundled nginx config sets
`max-age=300, must-revalidate`; if you put a CDN in front, match it.
:::

## building it yourself

```bash
git clone https://gitea.stump.rocks/stump.wtf/rack-planner
cd rack-planner
docker build -t rack-planner .
```

There is no build stage — nothing is compiled, bundled, or minified.

## stumpcloud deployment

`rack-planner.stump.rocks` runs on `ie01` via the `service` role in
`stumpcloud/ansible`. The role handles the Caddy vhost (two docker labels) and
the Route53 CNAME automatically from the service config; merging the playbook to
`main` converges it.

```yaml
rack_planner:
  name: rack-planner
  dns: rack-planner
  image: gitea.stump.rocks/stump.wtf/rack-planner:latest
  enabled: true
  port: 8080
  pull: always
```

The Gitea package must stay **public** — DUB hosts pull unauthenticated, and
there is no host-side registry auth to fall back on.

## development

```bash
make dev      # serve on :5173
make test     # node --test, no framework to install
make check    # lint + tests, the same targets CI runs
```
