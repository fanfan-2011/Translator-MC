using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;

// Wrapper around 7za.exe that injects -snl- (do not store symbolic links),
// so extracting archives containing symlinks (e.g. winCodeSign's macOS dylibs)
// does not fail on Windows without admin privileges.
class Program
{
    static int Main(string[] args)
    {
        var realPath = Path.Combine(AppContext.BaseDirectory, "7za-real.exe");
        if (!File.Exists(realPath))
        {
            Console.Error.WriteLine("7za-real.exe not found");
            return 127;
        }

        var psi = new ProcessStartInfo(realPath);
        var list = new List<string>(args);
        if (list.Count > 0)
            list.Insert(1, "-snl-");
        else
            list.Add("-snl-");
        foreach (var a in list)
            psi.ArgumentList.Add(a);
        psi.UseShellExecute = false;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;

        using (var p = Process.Start(psi))
        {
            p.OutputDataReceived += (s, e) => { if (e.Data != null) Console.Out.WriteLine(e.Data); };
            p.ErrorDataReceived += (s, e) => { if (e.Data != null) Console.Error.WriteLine(e.Data); };
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            p.WaitForExit();
            return p.ExitCode;
        }
    }
}
