document.addEventListener('DOMContentLoaded', async function() {

    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('dropdown-menu').classList.toggle('hidden');
        document.getElementById('line').classList.toggle('hidden');
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth >= 800) {
          document.getElementById('dropdown-menu').classList.add('hidden');
          document.getElementById('line').classList.add('hidden');
        }
      });

})