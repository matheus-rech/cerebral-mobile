import { useState, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

interface NiiVueViewerProps {
  imageUri: string;
  segmentationUri?: string;
  width?: number;
  height?: number;
}

export function NiiVueViewer({ imageUri, segmentationUri, width = 400, height = 500 }: NiiVueViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlContent] = useState(() => generateHTML(imageUri, segmentationUri));

  if (Platform.OS === "web") {
    // Use iframe with srcdoc for proper script execution on web
    return (
      <View style={[styles.container, { width, height }]}>
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="cross-origin-isolated"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView 
        source={{ html: htmlContent }} 
        style={styles.webview} 
        javaScriptEnabled 
        domStorageEnabled 
        scrollEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

function generateHTML(imageUri: string, segmentationUri?: string): string {
  // Using ES module import as per NiiVue documentation from Context7
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>NiiVue Brain Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { 
      background: #0a0a0a; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      color: #fff; 
      display: flex;
      flex-direction: column;
    }
    #viewer { 
      flex: 1;
      position: relative;
      min-height: 200px;
    }
    #gl { 
      width: 100% !important; 
      height: 100% !important;
      display: block;
    }
    .controls { 
      padding: 14px; 
      background: linear-gradient(180deg, #1a1a1a 0%, #111 100%);
      border-top: 1px solid #333;
    }
    .slider-row { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      margin: 8px 0; 
    }
    .slider-label { 
      width: 65px; 
      font-size: 12px; 
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .slider-label.axial { color: #0a7ea4; }
    .slider-label.coronal { color: #22c55e; }
    .slider-label.sagittal { color: #f59e0b; }
    .slider { 
      flex: 1; 
      height: 6px; 
      -webkit-appearance: none; 
      background: #333; 
      border-radius: 3px;
      cursor: pointer;
    }
    .slider::-webkit-slider-thumb { 
      -webkit-appearance: none; 
      width: 18px; 
      height: 18px; 
      background: #0a7ea4; 
      border-radius: 50%; 
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .slider.coronal::-webkit-slider-thumb { background: #22c55e; }
    .slider.sagittal::-webkit-slider-thumb { background: #f59e0b; }
    .slider-val { 
      width: 32px; 
      text-align: right; 
      font-size: 12px; 
      color: #888;
      font-variant-numeric: tabular-nums;
    }
    .btns { 
      display: flex; 
      gap: 6px; 
      margin-top: 12px; 
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn { 
      background: #0a7ea4; 
      border: none; 
      color: #fff; 
      padding: 8px 14px; 
      border-radius: 16px; 
      font-size: 12px; 
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn:hover { background: #0891b2; }
    .btn:active { transform: scale(0.97); }
    .btn.active {
      background: #06b6d4;
      box-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
    }
    .info { 
      font-size: 10px; 
      color: #555; 
      text-align: center; 
      margin-top: 10px;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #0a7ea4;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #333;
      border-top-color: #0a7ea4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .error {
      color: #ef4444;
      text-align: center;
      padding: 16px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="viewer">
    <canvas id="gl"></canvas>
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <span>Loading brain volume...</span>
    </div>
  </div>
  <div class="controls">
    <div class="slider-row">
      <span class="slider-label axial">Axial</span>
      <input type="range" class="slider" id="axial" min="0" max="100" value="50">
      <span class="slider-val" id="axial-val">50</span>
    </div>
    <div class="slider-row">
      <span class="slider-label coronal">Coronal</span>
      <input type="range" class="slider coronal" id="coronal" min="0" max="100" value="50">
      <span class="slider-val" id="coronal-val">50</span>
    </div>
    <div class="slider-row">
      <span class="slider-label sagittal">Sagittal</span>
      <input type="range" class="slider sagittal" id="sagittal" min="0" max="100" value="50">
      <span class="slider-val" id="sagittal-val">50</span>
    </div>
    <div class="btns">
      <button class="btn" id="btn-axial" onclick="setView('axial')">Axial</button>
      <button class="btn" id="btn-coronal" onclick="setView('coronal')">Coronal</button>
      <button class="btn" id="btn-sagittal" onclick="setView('sagittal')">Sagittal</button>
      <button class="btn" id="btn-3d" onclick="setView('3d')">3D</button>
      <button class="btn active" id="btn-multi" onclick="setView('multi')">Multi</button>
    </div>
    <div class="info">Drag sliders to navigate • Click to change view</div>
  </div>

  <script type="module">
    // Import NiiVue as ES module (per Context7 documentation)
    import { Niivue } from "https://unpkg.com/@niivue/niivue@0.57.0/dist/index.js";
    
    let nv = null;
    
    const hideLoading = () => {
      const el = document.getElementById('loading');
      if (el) el.style.display = 'none';
    };
    
    const showError = (msg) => {
      const el = document.getElementById('loading');
      if (el) {
        el.innerHTML = '<div class="error">⚠️ ' + msg + '</div>';
      }
    };
    
    const setupSliders = () => {
      const axes = ['axial', 'coronal', 'sagittal'];
      const mapping = { axial: 2, coronal: 1, sagittal: 0 };
      
      axes.forEach((axis) => {
        const slider = document.getElementById(axis);
        const val = document.getElementById(axis + '-val');
        if (!slider || !val) return;
        
        slider.oninput = () => {
          val.textContent = slider.value;
          if (!nv) return;
          const frac = slider.value / 100;
          const pos = [...nv.scene.crosshairPos];
          pos[mapping[axis]] = frac;
          nv.scene.crosshairPos = pos;
          nv.updateGLVolume();
        };
      });
    };
    
    window.setView = (v) => {
      if (!nv) return;
      
      // Update button states
      document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('btn-' + v);
      if (activeBtn) activeBtn.classList.add('active');
      
      const views = { 
        axial: nv.sliceTypeAxial, 
        coronal: nv.sliceTypeCoronal, 
        sagittal: nv.sliceTypeSagittal, 
        '3d': nv.sliceTypeRender, 
        multi: nv.sliceTypeMultiplanar 
      };
      nv.setSliceType(views[v]);
    };
    
    const init = async () => {
      try {
        console.log('Initializing NiiVue...');
        const canvas = document.getElementById('gl');
        if (!canvas) {
          showError('Canvas not found');
          return;
        }
        
        // Create NiiVue instance
        nv = new Niivue({ 
          backColor: [0.04, 0.04, 0.04, 1], 
          show3Dcrosshair: true,
          crosshairColor: [0.04, 0.5, 0.64, 1],
          crosshairWidth: 1
        });
        
        await nv.attachToCanvas(canvas);
        console.log('Canvas attached, loading volume...');
        
        // Load volumes
        const volumeList = [{ url: '${imageUri}', colormap: 'gray' }];
        ${segmentationUri ? `volumeList.push({ url: '${segmentationUri}', colormap: 'red', opacity: 0.5 });` : ''}
        
        await nv.loadVolumes(volumeList);
        console.log('Volume loaded successfully');
        
        nv.setSliceType(nv.sliceTypeMultiplanar);
        hideLoading();
        setupSliders();
        
      } catch(e) { 
        console.error('NiiVue error:', e);
        showError('Failed to load: ' + (e.message || e));
      }
    };
    
    // Initialize
    init();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { 
    backgroundColor: "#0a0a0a", 
    borderRadius: 16, 
    overflow: "hidden",
  },
  webview: { 
    flex: 1, 
    backgroundColor: "transparent",
  },
});
