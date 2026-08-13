---
name: aspnet-core-best-practices
description: Apply ASP.NET Core performance and reliability best practices from Microsoft docs — async over blocking, HttpClientFactory, HttpContext lifetime, EF Core queries, LOH/memory, pagination, middleware, and request/response I/O. Use when writing, reviewing, or refactoring ASP.NET Core, C# web APIs, controllers, Razor Pages, middleware, or .NET web apps.
---

# ASP.NET Core Best Practices

Guidelines for maximizing performance and reliability of ASP.NET Core apps. Distilled from [Microsoft Learn: ASP.NET Core Best Practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices?view=aspnetcore-10.0) (ASP.NET Core 10).

A **hot code path** is frequently called code where much of the execution time occurs. These paths limit scale-out and performance.

For full good/bad C# samples, see [examples.md](examples.md).

## When to apply

- Writing or reviewing ASP.NET Core controllers, Razor Pages, Minimal APIs, or middleware
- Implementing data access, HTTP calls, background work, or request/response I/O
- Diagnosing thread-pool starvation, high GC, slow endpoints, or `HttpContext` bugs

## Review checklist

- [ ] No `Task.Wait`, `.Result`, or `GetAwaiter().GetResult()` on hot paths
- [ ] No `Task.Run` just to wrap work that is already on the thread pool
- [ ] Controller/page actions are `async Task` (never `async void`)
- [ ] Data access, I/O, and HTTP calls use async APIs
- [ ] Large collections are paginated; no unbounded dumps
- [ ] `HttpClient` comes from `IHttpClientFactory`, not `new HttpClient()`
- [ ] `HttpContext` is not stored, shared across threads, or used after the request
- [ ] Request/response bodies are read/written asynchronously and not fully buffered if large
- [ ] Forms use `ReadFormAsync`, not `Request.Form` on first read
- [ ] Headers are set before the response starts (`HasStarted` / `OnStarting`)
- [ ] Exceptions are not used for normal control flow
- [ ] EF queries filter/aggregate in the database; no-tracking for reads

---

## Cache aggressively

Cache frequently used large objects and frequently accessed remote/DB data when slightly stale data is acceptable. Use `MemoryCache` or `DistributedCache`. See [caching overview](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/overview).

## Avoid blocking calls

ASP.NET Core handles many concurrent requests with a small thread pool. Blocking causes [thread-pool starvation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation).

**Do**
- Make hot paths and controller/Razor Page actions asynchronous end-to-end
- Call data access, I/O, and long-running APIs asynchronously when an async API exists
- Offload very long work to a message broker (e.g. Azure Service Bus)

**Do not**
- Block with `Task.Wait` or `Task<T>.Result`
- Acquire locks on common code paths
- Call `Task.Run` and immediately await it — the app already runs on thread-pool threads; `Task.Run` only adds extra scheduling and does not make blocking work safe
- Wrap a sync API in `Task.Run` to "make it async"

Detect starvation with PerfView: `Microsoft-Windows-DotNETRuntime/ThreadPoolWorkerThread/Start`.

## Return large collections in pages

Unbounded collections cause OOM, high memory, thread-pool starvation, slow responses, and frequent GC.

**Do** paginate with page size + page index. For exhaustive results, stream batches asynchronously.

Returning `IEnumerable<T>` from an action makes the serializer iterate **synchronously**. Prefer `ToListAsync` before return, or return `IAsyncEnumerable<T>` (ASP.NET Core 3.0+) so enumeration is async.

## Minimize large object allocations

Objects ≥ 85,000 bytes go on the [large object heap](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap) and need a Gen2 GC (app pause).

**Do**
- Cache frequently used large objects
- Pool large arrays with `ArrayPool<T>`

**Do not** allocate many short-lived large objects on hot paths.

## Optimize data access and I/O

**Do**
- Call all data-access APIs asynchronously
- Return only the data needed for this request
- Cache frequently accessed remote/DB data when staleness is OK
- Minimize round trips (one call, not N)
- Use EF Core **no-tracking** queries for read-only access
- Filter and aggregate in LINQ (`.Where`, `.Select`, `.Sum`, …) so the **database** does the work
- Watch for EF Core **client evaluation** (operators that run in-memory)

**Do not**
- Use projection queries on collections in a way that causes N+1 SQL

High-scale options (measure before adopting): [DbContext pooling](https://learn.microsoft.com/en-us/ef/core/performance/advanced-performance-topics#dbcontext-pooling), [compiled queries](https://learn.microsoft.com/en-us/ef/core/performance/advanced-performance-topics#compiled-queries). Extra complexity of compiled queries often is not worth it.

## Pool HTTP connections with HttpClientFactory

`HttpClient` is designed for reuse. Creating and disposing instances leaves sockets in `TIME_WAIT` and can exhaust sockets.

**Do not** `new HttpClient()` / dispose on hot paths.
**Do** resolve `HttpClient` from `IHttpClientFactory`.

## Keep common code paths fast

Most critical: middleware (especially early pipeline), and code that runs every request or multiple times per request (custom logging, authorization handlers, transient service init).

**Do not** put long-running work in custom middleware.
**Do** profile with Visual Studio Diagnostic Tools or PerfView.

## Complete long-running work outside the HTTP request

**Do not** wait for long-running tasks as part of ordinary request processing.

**Do**
- Use [hosted background services](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services), Azure Functions, and/or a message broker
- Use SignalR (or similar) to notify clients asynchronously
- Prefer out-of-process completion for CPU-intensive work

## Client assets and responses

- Bundle and minify JS/CSS/images; use the `environment` tag for Development vs Production
- Consider Webpack (or similar) for complex front ends
- Enable [response compression](https://learn.microsoft.com/en-us/aspnet/core/performance/response-compression)

Prefer the **latest ASP.NET Core** release — newer versions generally outperform older ones.

## Minimize exceptions

Throwing/catching is slow. Do not use exceptions for normal control flow, especially on hot paths. Detect expected conditions in logic; throw only for unusual/unexpected cases.

## Request and response body I/O

All I/O in ASP.NET Core is async. Prefer async `Stream` overloads. Sync reads on Kestrel are **sync-over-async** (Kestrel does not support sync reads).

**Do not** `StreamReader.ReadToEnd()` on `Request.Body`.
**Do** `ReadToEndAsync`, or better: `JsonSerializer.DeserializeAsync<T>(Request.Body)` (no full string buffer).

Prefer `System.Text.Json` (async, UTF-8, typically faster than Newtonsoft). If a serializer is sync-only (e.g. Json.NET), **buffer asynchronously first**, then deserialize — still avoid huge bodies in memory.

**Do not** store a large request/response in a single `byte[]` or `string` (LOH + full GCs; large bodies can OOM / DoS).

### Forms

Use `await HttpContext.Request.ReadFormAsync()`. `Request.Form` is safe **only after** `ReadFormAsync` has already populated the cache. First access via `.Form` is sync-over-async.

## HttpContext rules

`HttpContext` is **not thread-safe**, is valid **only during the active request**, and is recycled when the pipeline `Task` completes.

| Rule | Wrong | Right |
|------|--------|--------|
| Accessor | Store `accessor.HttpContext` in a field (often null/wrong) | Store `IHttpContextAccessor`; read `.HttpContext` at use time; null-check |
| Threads | Read `HttpContext` from parallel tasks | Copy needed values (e.g. path) **before** `Task.WhenAll` |
| After request | `async void` actions; write to `Response` after completion | Return `async Task` so the framework waits |
| Background | Closure captures `HttpContext` / controller in `Task.Run` | Copy data during the request; don't touch controller |
| Scoped services | Capture request-scoped `DbContext` in `Task.Run` | Inject singleton `IServiceScopeFactory`; `CreateAsyncScope()` on the background thread |
| Headers | Set headers after `await next()` that wrote the body | Check `!Response.HasStarted`, or register `Response.OnStarting` **before** `await next()` |

**Never** use `async void` in ASP.NET Core — the request completes at the first `await`, then later `Response` access can crash the process.

Prefer hosted services over fire-and-forget `Task.Run`. If you must run background work, do not capture the controller, `HttpContext`, or scoped services.

**Do not** call `next()` if you have already started writing the response body. Downstream components expect to still be able to handle the response.

## IIS hosting

Prefer **in-process** hosting with IIS (default since ASP.NET Core 3.0). The app runs in the IIS worker process; requests are not proxied over loopback.

## HttpRequest.ContentLength can be null

`ContentLength` is **null** when the `Content-Length` header is missing — length unknown, **not** zero. Comparisons like `Request.ContentLength > 1024` are `false` when it is null, even if the body is huge. Do not use this as a request-size guard.

## Additional resources

- Code samples: [examples.md](examples.md)
- [Enterprise web app patterns](https://learn.microsoft.com/en-us/azure/architecture/web-apps/guides/enterprise-app-patterns/overview)
- [David Fowler — ASP.NET Core diagnostic scenarios (async)](https://github.com/davidfowl/AspNetCoreDiagnosticScenarios/blob/master/AsyncGuidance.md)

## Attribution

Adapted from Microsoft’s [ASP.NET Core Best Practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices?view=aspnetcore-10.0) (source: [dotnet/AspNetCore.Docs](https://github.com/dotnet/AspNetCore.Docs/blob/live/aspnetcore/fundamentals/best-practices.md)).

- Documentation: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Code samples: MIT License, Copyright (c) Microsoft Corporation

This skill is a condensed, modified rewrite of that article, not a verbatim copy.
