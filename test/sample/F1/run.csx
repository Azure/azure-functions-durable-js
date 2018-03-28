public static async Task<string> Run(string name, TraceWriter log)
{
    log.Info("Starting F1");
    await Task.Delay(TimeSpan.FromSeconds(5));
    log.Info("Returning F1");
    return $"F1";
}