# ASP.NET Core best-practice examples

Good vs bad patterns from [Microsoft Learn: ASP.NET Core Best Practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices?view=aspnetcore-10.0). Use these when generating or reviewing C# in ASP.NET Core apps.

## Async request body

**Bad** — sync `ReadToEnd` (sync-over-async on Kestrel):

```csharp
public ActionResult<ContosoData> Get()
{
    var json = new StreamReader(Request.Body).ReadToEnd();
    return JsonSerializer.Deserialize<ContosoData>(json);
}
```

**Good** — async read:

```csharp
public async Task<ActionResult<ContosoData>> Get()
{
    var json = await new StreamReader(Request.Body).ReadToEndAsync();
    return JsonSerializer.Deserialize<ContosoData>(json);
}
```

**Better** — stream deserialize (no full string in memory):

```csharp
public async Task<ActionResult<ContosoData>> Get()
{
    return await JsonSerializer.DeserializeAsync<ContosoData>(Request.Body);
}
```

Still avoid this for unbounded/large bodies (OOM / DoS).

## ReadFormAsync

**Bad** — `Request.Form` on first access is sync-over-async:

```csharp
public IActionResult Post()
{
    var form = HttpContext.Request.Form;
    Process(form["id"], form["name"]);
    return Accepted();
}
```

**Good:**

```csharp
public async Task<IActionResult> Post()
{
    var form = await HttpContext.Request.ReadFormAsync();
    Process(form["id"], form["name"]);
    return Accepted();
}
```

## Do not store HttpContext in a field

**Bad** — constructor captures a null or wrong context:

```csharp
public class MyBadType
{
    private readonly HttpContext _context;
    public MyBadType(IHttpContextAccessor accessor)
    {
        _context = accessor.HttpContext;
    }
}
```

**Good** — store the accessor; read at use time:

```csharp
public class MyGoodType
{
    private readonly IHttpContextAccessor _accessor;
    public MyGoodType(IHttpContextAccessor accessor) => _accessor = accessor;

    public void CheckAdmin()
    {
        var context = _accessor.HttpContext;
        if (context != null && !context.User.IsInRole("admin"))
            throw new UnauthorizedAccessException("The current user isn't an admin");
    }
}
```

## Do not access HttpContext from multiple threads

**Bad** — parallel tasks read `HttpContext.Request.Path`:

```csharp
public async Task<SearchResults> Get(string query)
{
    var query1 = SearchAsync(SearchEngine.Google, query);
    var query2 = SearchAsync(SearchEngine.Bing, query);
    await Task.WhenAll(query1, query2);
    // SearchAsync logs HttpContext.Request.Path — not thread-safe
}

private async Task<SearchResults> SearchAsync(SearchEngine engine, string query)
{
    _logger.LogInformation("Starting search from {path}.", HttpContext.Request.Path);
    return await _searchService.SearchAsync(engine, query);
}
```

**Good** — copy values first; pass them in:

```csharp
public async Task<SearchResults> Get(string query)
{
    string path = HttpContext.Request.Path;
    var query1 = SearchAsync(SearchEngine.Google, query, path);
    var query2 = SearchAsync(SearchEngine.Bing, query, path);
    await Task.WhenAll(query1, query2);
    return SearchResults.Combine(await query1, await query2);
}

private async Task<SearchResults> SearchAsync(SearchEngine engine, string query, string path)
{
    _logger.LogInformation("Starting search from {path}.", path);
    return await _searchService.SearchAsync(engine, query);
}
```

## Do not use HttpContext after the request completes

**Bad** — `async void` completes the request at the first `await`:

```csharp
[HttpGet("/async")]
public async void Get()
{
    await Task.Delay(1000);
    await Response.WriteAsync("Hello World"); // can crash the process
}
```

**Good:**

```csharp
[HttpGet("/async")]
public async Task Get()
{
    await Task.Delay(1000);
    await Response.WriteAsync("Hello World");
}
```

## Do not capture HttpContext in background work

**Bad:**

```csharp
public IActionResult BadFireAndForget()
{
    _ = Task.Run(async () =>
    {
        await Task.Delay(1000);
        Log(HttpContext.Request.Path); // request may be gone
    });
    return Accepted();
}
```

**Good** — copy data; do not close over the controller:

```csharp
public IActionResult GoodFireAndForget()
{
    string path = HttpContext.Request.Path;
    _ = Task.Run(async () =>
    {
        await Task.Delay(1000);
        Log(path);
    });
    return Accepted();
}
```

Prefer a hosted service over `Task.Run`.

## Do not capture scoped services in background work

**Bad** — request-scoped `DbContext` disposed when the request ends:

```csharp
public IActionResult FireAndForget1([FromServices] ContosoDbContext context)
{
    _ = Task.Run(async () =>
    {
        await Task.Delay(1000);
        context.Contoso.Add(new Contoso());
        await context.SaveChangesAsync(); // ObjectDisposedException
    });
    return Accepted();
}
```

**Good** — singleton `IServiceScopeFactory`, new scope on the background thread:

```csharp
public IActionResult FireAndForget3([FromServices] IServiceScopeFactory serviceScopeFactory)
{
    _ = Task.Run(async () =>
    {
        await Task.Delay(1000);
        await using var scope = serviceScopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<ContosoDbContext>();
        context.Contoso.Add(new Contoso());
        await context.SaveChangesAsync();
    });
    return Accepted();
}
```

## Headers after the response has started

**Bad** — may throw if `next()` already wrote the body:

```csharp
app.Use(async (context, next) =>
{
    await next();
    context.Response.Headers["test"] = "test value";
});
```

**Good** — guard:

```csharp
app.Use(async (context, next) =>
{
    await next();
    if (!context.Response.HasStarted)
        context.Response.Headers["test"] = "test value";
});
```

**Better** — `OnStarting` before `next()` (no need to know downstream middleware):

```csharp
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["someheader"] = "somevalue";
        return Task.CompletedTask;
    });
    await next();
});
```

## HttpClient

**Bad:** `using var client = new HttpClient();` on a hot path.

**Good:** register `builder.Services.AddHttpClient(...)` and inject `HttpClient` or `IHttpClientFactory`.

## Blocking and Task.Run

**Bad:**

```csharp
var data = GetDataAsync().Result;       // or .Wait()
await Task.Run(() => ExpensiveSyncWork());
```

**Good:** `var data = await GetDataAsync();` — and if the only API is sync, call it directly on the request thread or offload via a hosted service / queue, not `Task.Run` + await.
