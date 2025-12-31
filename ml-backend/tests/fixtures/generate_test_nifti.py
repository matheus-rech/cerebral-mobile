"""
Generate a small test NIfTI file for fast gateway testing.
Creates a 16x16x16 volume with random data.

Run with: python generate_test_nifti.py

This version uses only standard library modules (no numpy required).
"""

import gzip
import struct
import random
import math
from pathlib import Path


def create_nifti_header(shape=(16, 16, 16)):
    """
    Create a minimal NIfTI-1 header.

    NIfTI-1 header is 348 bytes followed by 4-byte extension indicator.
    """
    header = bytearray(348)

    # sizeof_hdr (bytes 0-3): must be 348 for NIfTI-1
    struct.pack_into('<i', header, 0, 348)

    # dim (bytes 40-55): array dimensions
    # dim[0] = number of dimensions (3 for 3D volume)
    # dim[1-7] = size of each dimension
    struct.pack_into('<h', header, 40, 3)  # ndim
    struct.pack_into('<h', header, 42, shape[0])  # dim1
    struct.pack_into('<h', header, 44, shape[1])  # dim2
    struct.pack_into('<h', header, 46, shape[2])  # dim3
    struct.pack_into('<h', header, 48, 1)  # dim4 (time)
    struct.pack_into('<h', header, 50, 1)  # dim5
    struct.pack_into('<h', header, 52, 1)  # dim6
    struct.pack_into('<h', header, 54, 1)  # dim7

    # datatype (bytes 70-71): 16 = float32
    struct.pack_into('<h', header, 70, 16)

    # bitpix (bytes 72-73): bits per voxel (32 for float32)
    struct.pack_into('<h', header, 72, 32)

    # pixdim (bytes 76-107): voxel dimensions
    # pixdim[0] = qfac (usually 1.0)
    # pixdim[1-3] = voxel sizes in mm
    struct.pack_into('<f', header, 76, 1.0)  # qfac
    struct.pack_into('<f', header, 80, 1.0)  # pixdim[1] - voxel size x
    struct.pack_into('<f', header, 84, 1.0)  # pixdim[2] - voxel size y
    struct.pack_into('<f', header, 88, 1.0)  # pixdim[3] - voxel size z

    # vox_offset (bytes 108-111): offset to data (352 = 348 header + 4 extension)
    struct.pack_into('<f', header, 108, 352.0)

    # scl_slope and scl_inter (bytes 112-119): intensity scaling
    struct.pack_into('<f', header, 112, 1.0)  # scl_slope
    struct.pack_into('<f', header, 116, 0.0)  # scl_inter

    # xyzt_units (byte 123): mm + sec
    header[123] = 0b00000010  # NIFTI_UNITS_MM

    # magic (bytes 344-347): "n+1" followed by null for NIfTI-1 single file
    header[344:348] = b'n+1\x00'

    return bytes(header)


def create_test_nifti(output_path, shape=(16, 16, 16), seed=42):
    """
    Create a small test NIfTI file.

    Args:
        output_path: Path to save the .nii.gz file
        shape: Volume dimensions (default 16x16x16)
        seed: Random seed for reproducibility
    """
    random.seed(seed)

    # Generate volume data (3D array of float32 values)
    num_voxels = shape[0] * shape[1] * shape[2]
    volume_data = []

    # Center of the volume for adding a "lesion"
    center = tuple(s // 2 for s in shape)
    radius = min(shape) // 4

    # Generate data in the order expected by NIfTI (Fortran order, x fastest)
    for z in range(shape[2]):
        for y in range(shape[1]):
            for x in range(shape[0]):
                # Base random value (0 to 1)
                value = random.random()

                # Add a "lesion" - a bright spot in the center
                dist = math.sqrt(
                    (x - center[0])**2 +
                    (y - center[1])**2 +
                    (z - center[2])**2
                )
                if dist < radius:
                    value = min(1.0, value + 0.5)

                volume_data.append(value)

    # Pack as float32 values
    data_bytes = struct.pack(f'<{num_voxels}f', *volume_data)

    # Create NIfTI header
    header = create_nifti_header(shape)

    # Extension: 4 bytes of zeros (no extension)
    extension = b'\x00\x00\x00\x00'

    # Combine header + extension + data
    nifti_data = header + extension + data_bytes

    # Compress and save
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with gzip.open(output_path, 'wb') as f:
        f.write(nifti_data)

    file_size = output_path.stat().st_size
    print(f"Created test NIfTI file: {output_path}")
    print(f"  Shape: {shape}")
    print(f"  Size: {file_size} bytes")
    print(f"  Voxels: {num_voxels}")

    return output_path


if __name__ == "__main__":
    fixtures_dir = Path(__file__).parent
    output_path = fixtures_dir / "small_brain.nii.gz"
    create_test_nifti(output_path)
