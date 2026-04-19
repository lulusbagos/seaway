using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SeaWay.Controllers;

[Authorize]
public class CameraProxyController(IHttpClientFactory httpClientFactory) : Controller
{
    private const string CameraOrigin = "http://103.245.39.218:8080";
    private static readonly HashSet<string> HopByHopHeaders =
    [
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade"
    ];

    [HttpGet]
    [HttpPost]
    [HttpPut]
    [HttpDelete]
    [HttpPatch]
    [HttpHead]
    [Route("808gps")]
    [Route("808gps/{**path}")]
    [Route("StandardApiAction_{apiName}.action")]
    public async Task<IActionResult> Proxy(string? path = null, string? apiName = null)
    {
        var targetPath = BuildTargetPath(path, apiName);
        if (string.IsNullOrWhiteSpace(targetPath))
        {
            return NotFound();
        }

        var targetUri = new Uri($"{CameraOrigin}{targetPath}{Request.QueryString}");
        using var requestMessage = new HttpRequestMessage(new HttpMethod(Request.Method), targetUri);

        CopyRequestHeaders(requestMessage);

        if (Request.ContentLength > 0 && Request.Body.CanRead && Request.Method is not "GET" and not "HEAD")
        {
            requestMessage.Content = new StreamContent(Request.Body);
            CopyContentHeaders(requestMessage.Content.Headers);
        }

        var client = httpClientFactory.CreateClient();
        using var responseMessage = await client.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, HttpContext.RequestAborted);

        Response.StatusCode = (int)responseMessage.StatusCode;
        CopyResponseHeaders(responseMessage);

        if (Request.Method == HttpMethods.Head)
        {
            return new EmptyResult();
        }

        var contentType = responseMessage.Content.Headers.ContentType?.MediaType ?? string.Empty;
        var responseBytes = await responseMessage.Content.ReadAsByteArrayAsync(HttpContext.RequestAborted);

        if (!IsTextualContent(contentType))
        {
            return File(responseBytes, string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);
        }

        var responseBody = RewriteCameraLinks(responseMessage.Content.Headers.ContentType?.CharSet is { Length: > 0 } charset
            ? System.Text.Encoding.GetEncoding(charset).GetString(responseBytes)
            : System.Text.Encoding.UTF8.GetString(responseBytes));
        return Content(responseBody, contentType);
    }

    private static string BuildTargetPath(string? path, string? apiName)
    {
        if (!string.IsNullOrWhiteSpace(apiName))
        {
            return $"/StandardApiAction_{apiName}.action";
        }

        if (string.IsNullOrWhiteSpace(path))
        {
            return "/808gps";
        }

        return $"/808gps/{path}";
    }

    private void CopyRequestHeaders(HttpRequestMessage requestMessage)
    {
        foreach (var header in Request.Headers)
        {
            if (HopByHopHeaders.Contains(header.Key.ToLowerInvariant()) || header.Key.Equals("host", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!requestMessage.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
            {
                requestMessage.Content?.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
            }
        }
    }

    private void CopyContentHeaders(HttpContentHeaders targetHeaders)
    {
        foreach (var header in Request.Headers)
        {
            if (header.Key.StartsWith("content-", StringComparison.OrdinalIgnoreCase))
            {
                targetHeaders.TryAddWithoutValidation(header.Key, header.Value.ToArray());
            }
        }
    }

    private void CopyResponseHeaders(HttpResponseMessage responseMessage)
    {
        foreach (var header in responseMessage.Headers)
        {
            if (HopByHopHeaders.Contains(header.Key.ToLowerInvariant()))
            {
                continue;
            }

            Response.Headers[header.Key] = header.Value.ToArray();
        }

        foreach (var header in responseMessage.Content.Headers)
        {
            if (HopByHopHeaders.Contains(header.Key.ToLowerInvariant()))
            {
                continue;
            }

            Response.Headers[header.Key] = header.Value.ToArray();
        }
    }

    private static bool IsTextualContent(string contentType)
    {
        return contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("json", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("xml", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("svg", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase);
    }

    private static string RewriteCameraLinks(string content)
    {
        var rewritten = content.Replace("http://103.245.39.218:8080", string.Empty, StringComparison.OrdinalIgnoreCase)
                               .Replace("https://103.245.39.218:8080", string.Empty, StringComparison.OrdinalIgnoreCase);

        rewritten = rewritten.Replace("src=\"/808gps/", "src=\"/808gps/", StringComparison.OrdinalIgnoreCase);
        rewritten = rewritten.Replace("href=\"/808gps/", "href=\"/808gps/", StringComparison.OrdinalIgnoreCase);

        return rewritten;
    }
}
