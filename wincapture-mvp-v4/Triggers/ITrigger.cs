namespace WinCaptureMVP.Triggers
{
    public interface ITrigger
    {
        void Start();
        void Stop();
        void Pause();
        void Resume();
    }
}
