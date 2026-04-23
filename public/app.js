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
                                                                                       fetch('/api/scans', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ voucherCode: mockData })
            })
            .then(async res => {
                const data = await res.json();
                if (res.status === 400 || data.message === 'Duplicate code') {
                    document.getElementById('error-sound').play();
                    const resultDiv = document.getElementById('result');
                    resultDiv.style.color = '#ef4444';
                    resultDiv.style.borderColor = '#ef4444';
                    dataDiv.innerText = 'خطأ: الكود مكرر مسبقاً!';
                    throw new Error('Duplicate code');
                }
                return data;
            })
            .then(result => {
                console.log('Scan saved:', result);
                const resultDiv = document.getElementById('result');
                resultDiv.style.color = '';
                resultDiv.style.borderColor = '';
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

