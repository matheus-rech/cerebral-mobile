# OpenNeuro API Integration

## Overview
OpenNeuro provides a GraphQL API for accessing neuroimaging datasets. The API endpoint is:
- **GraphQL Playground**: https://openneuro.org/crn/graphql

## Key Features
- Query dataset metadata and file trees
- Access BIDS-formatted neuroimaging data
- Download NIfTI files for MRI analysis

## Example Queries

### Query Dataset Information
```graphql
query {
  dataset(id: "ds000224") {
    id
    name
  }
}
```

### Get Snapshot Files
```graphql
query snapshotFiles {
  snapshot(datasetId: "ds000001", tag: "1.0.0") {
    files {
      id
      key
      filename
      size
      directory
      annexed
    }
  }
}
```

### Get Specific Snapshot Description
```graphql
query {
  snapshot(datasetId: "ds000224", tag: "1.0.1") {
    id
    tag
    description {
      Name
      DatasetDOI
    }
  }
}
```

## Useful Datasets for Brain MRI Analysis
- **ds000224** - The Midnight Scan Club (MSC) dataset
- **ds000001** - Example BIDS dataset
- **ds007045** - OpenNeuro dataset with brain MRI

## Integration Notes
- OpenNeuro uses GraphQL, not REST
- Files are stored in git-annex format
- Public datasets can be accessed without authentication
- NIfTI files (.nii.gz) are the standard format

## File Download URLs
For public datasets, files can be downloaded via:
```
https://s3.amazonaws.com/openneuro.org/{datasetId}/{snapshotTag}/{filepath}
```
