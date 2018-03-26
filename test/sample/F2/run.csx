public static async Task<string> Run(string name, TraceWriter log)
{
    log.Info("Starting F2");
    //await Task.Delay(TimeSpan.FromSeconds(5));
    log.Info("Returning F2");
    return $"F2";
}