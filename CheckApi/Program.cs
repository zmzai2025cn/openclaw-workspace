using System;
using System.Linq;
using System.Reflection;

class CheckApi
{
    static void Main()
    {
        try
        {
            string dllPath = Environment.ExpandEnvironmentVariables(@"%USERPROFILE%\.nuget\packages\paddleocrsharp\4.1.0\lib\net6.0\PaddleOCRSharp.dll");
            Console.WriteLine("Loading: " + dllPath);
            
            var assembly = Assembly.LoadFrom(dllPath);
            
            var engineType = assembly.GetTypes().FirstOrDefault(t => t.Name == "PaddleOCREngine");
            if (engineType == null)
            {
                Console.WriteLine("PaddleOCREngine not found");
                return;
            }
            
            Console.WriteLine("\n=== Constructors ===");
            foreach (var ctor in engineType.GetConstructors())
            {
                var ps = string.Join(", ", ctor.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name));
                Console.WriteLine("PaddleOCREngine(" + ps + ")");
            }
            
            Console.WriteLine("\n=== Methods ===");
            var methods = engineType.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
            foreach (var m in methods)
            {
                var ps = string.Join(", ", m.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name));
                Console.WriteLine(m.ReturnType.Name + " " + m.Name + "(" + ps + ")");
            }
            
            Console.WriteLine("\n=== OCRResult Properties ===");
            var resultType = assembly.GetTypes().FirstOrDefault(t => t.Name == "OCRResult");
            if (resultType != null)
            {
                foreach (var p in resultType.GetProperties())
                {
                    Console.WriteLine(p.PropertyType.Name + " " + p.Name);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
