import { ChevronRight, CornerLeftUp, Folder, HardDrive } from 'lucide-react';
import type { FolderListing } from '../../torrents/types';

type Props = { listing: FolderListing; on_open: (path: string | null) => void };

export function FolderRows({ listing, on_open }: Props) {
  const drives = listing.path === null;
  const Icon = drives ? HardDrive : Folder;
  return <ul className="folder-rows">
    {listing.path !== null && <li>
      <button type="button" className="folder-row" onClick={() => on_open(listing.parent)}>
        <CornerLeftUp /><span className="folder-name">{listing.parent === null ? 'All drives' : 'Up one folder'}</span>
      </button>
    </li>}
    {listing.folders.map(folder => <li key={folder.path}>
      <button type="button" className="folder-row" onClick={() => on_open(folder.path)}>
        <Icon /><span className="folder-name">{folder.name}</span><ChevronRight className="folder-open" />
      </button>
    </li>)}
    {listing.folders.length === 0 && <li className="folder-empty">{drives ? 'No drives were found.' : 'No folders in here.'}</li>}
  </ul>;
}
