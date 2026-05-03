function showScreen(id)
{
    document.querySelector('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target)
    {
        target.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
}

document.addEventListener('DOMContentLoaded', () =>
{
    document.querySelector('a[href="navigator.html"]:nth-child(1)').addEventListener('click', e =>
    {
        e.preventDefault();
        applyPreset('wheelchair');
        window.location.href = 'navigator.html';
    });

    document.querySelector('a[href="navigator.html"]:nth-child(2)').addEventListener('click', e => 
        {
            e.preventDefault();
            applyPreset('vi');
            window.location.href = 'navigator.html';
        });

    document.querySelector('a[href="navigator.html"]:nth-child(3)').addEventListener('click', e => 
        {
            e.preventDefault();
            applyPreset('reporter');
            window.location.href = 'navigator.html';
        })
});