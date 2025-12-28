"""
Test script for MONAI integration
Tests preprocessing and segmentation capabilities
"""

import sys
import os

def test_imports():
    """Test that all required packages can be imported"""
    print("Testing imports...")
    
    try:
        import torch
        print(f"✓ PyTorch {torch.__version__}")
        print(f"  CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"  CUDA version: {torch.version.cuda}")
            print(f"  GPU: {torch.cuda.get_device_name(0)}")
    except ImportError as e:
        print(f"✗ PyTorch import failed: {e}")
        return False
    
    try:
        import monai
        print(f"✓ MONAI {monai.__version__}")
    except ImportError as e:
        print(f"✗ MONAI import failed: {e}")
        return False
    
    try:
        import nibabel as nib
        print(f"✓ NiBabel {nib.__version__}")
    except ImportError as e:
        print(f"✗ NiBabel import failed: {e}")
        return False
    
    try:
        import numpy as np
        print(f"✓ NumPy {np.__version__}")
    except ImportError as e:
        print(f"✗ NumPy import failed: {e}")
        return False
    
    try:
        import scipy
        print(f"✓ SciPy {scipy.__version__}")
    except ImportError as e:
        print(f"✗ SciPy import failed: {e}")
        return False
    
    try:
        from PIL import Image
        print(f"✓ Pillow")
    except ImportError as e:
        print(f"✗ Pillow import failed: {e}")
        return False
    
    try:
        import flask
        print(f"✓ Flask {flask.__version__}")
    except ImportError as e:
        print(f"✗ Flask import failed: {e}")
        return False
    
    print("\nAll imports successful!\n")
    return True

def test_monai_transforms():
    """Test MONAI transforms"""
    print("Testing MONAI transforms...")
    
    try:
        from monai.transforms import (
            Compose,
            LoadImaged,
            EnsureChannelFirstd,
            Spacingd,
            Orientationd,
            ScaleIntensityRanged,
            ToTensord,
        )
        
        # Create a simple transform pipeline
        transforms = Compose([
            EnsureChannelFirstd(keys=["image"]),
            ScaleIntensityRanged(
                keys=["image"],
                a_min=0,
                a_max=255,
                b_min=0.0,
                b_max=1.0,
                clip=True,
            ),
            ToTensord(keys=["image"]),
        ])
        
        print("✓ MONAI transforms created successfully")
        return True
    
    except Exception as e:
        print(f"✗ MONAI transforms test failed: {e}")
        return False

def test_monai_model():
    """Test MONAI model creation"""
    print("\nTesting MONAI model...")
    
    try:
        import torch
        from monai.networks.nets import UNet
        
        model = UNet(
            spatial_dims=3,
            in_channels=1,
            out_channels=3,
            channels=(16, 32, 64, 128, 256),
            strides=(2, 2, 2, 2),
            num_res_units=2,
        )
        
        # Count parameters
        total_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        
        print(f"✓ MONAI UNet model created")
        print(f"  Total parameters: {total_params:,}")
        print(f"  Trainable parameters: {trainable_params:,}")
        
        # Test forward pass with dummy data
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        model.eval()
        
        dummy_input = torch.randn(1, 1, 96, 96, 96).to(device)
        
        with torch.no_grad():
            output = model(dummy_input)
        
        print(f"  Input shape: {dummy_input.shape}")
        print(f"  Output shape: {output.shape}")
        print(f"✓ Forward pass successful")
        
        return True
    
    except Exception as e:
        print(f"✗ MONAI model test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_sliding_window_inference():
    """Test MONAI sliding window inference"""
    print("\nTesting sliding window inference...")
    
    try:
        import torch
        from monai.networks.nets import UNet
        from monai.inferers import sliding_window_inference
        
        model = UNet(
            spatial_dims=3,
            in_channels=1,
            out_channels=3,
            channels=(16, 32, 64),
            strides=(2, 2),
            num_res_units=2,
        )
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        model.eval()
        
        # Create dummy input (larger than model input)
        dummy_input = torch.randn(1, 1, 128, 128, 128).to(device)
        
        with torch.no_grad():
            output = sliding_window_inference(
                inputs=dummy_input,
                roi_size=(96, 96, 96),
                sw_batch_size=4,
                predictor=model,
                overlap=0.5,
            )
        
        print(f"  Input shape: {dummy_input.shape}")
        print(f"  Output shape: {output.shape}")
        print(f"✓ Sliding window inference successful")
        
        return True
    
    except Exception as e:
        print(f"✗ Sliding window inference test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("MONAI Integration Test Suite")
    print("=" * 60)
    print()
    
    results = []
    
    # Test imports
    results.append(("Imports", test_imports()))
    
    # Test transforms
    results.append(("Transforms", test_monai_transforms()))
    
    # Test model
    results.append(("Model Creation", test_monai_model()))
    
    # Test inference
    results.append(("Sliding Window Inference", test_sliding_window_inference()))
    
    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! MONAI is ready to use.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
