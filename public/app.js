document.addEventListener('DOMContentLoaded', () => {
      const startBtn = document.getElementById('start-btn');
      const stopBtn = document.getElementById('stop-btn');
      const dataDiv = document.getElementById('data');

                              let isScanning = false;

                              startBtn.addEventListener('click', () => {
                                        if (isScanning) return;
                                        isScanning = true;
                                        dataDiv.innerText = 'Scanning...';

                                                                // Simulate a scan result after 2 seconds
                                                                setTimeout(() => {
                                                                              const mockData = 'TOBAL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                                                                              dataDiv.innerText = 'Scanned: ' + mockData;

                                                                                       // Send result to backend
                                                                                       fetch('/api/scan', {
                                                                                                         method: 'POST',
                                                                                                         headers: { 'Content-Type': 'application/json' },
                                                                                                         body: JSON.stringify({ data: mockData })
                                                                                         })
                                                                              .then(res => res.json())
                                                                              .then(result => {
                                                                                                console.log('Scan saved:', result);
                                                                              })
                                                                              .catch(err => {
                                                                                                console.error('Error saving scan:', err);
                                                                              });

                                                                                       isScanning = false;
                                                                }, 2000);
                              });

                              stopBtn.addEventListener('click', () => {
                                        isScanning = false;
                                        dataDiv.innerText = 'Scanner stopped.';
                              });

                              // Check backend status on load
                              fetch('/api/status')
          .then(res => res.json())
          .then(data => {
                        console.log('Backend status:', data.status);
          })
          .catch(err => {
                        console.error('Backend unreachable:', err);
          });
});
