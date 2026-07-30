import { tiles as defaultTiles, type Tile as TileData } from "@/lib/tiles";
import Tile from "./Tile";

export default function TileGrid({ tiles = defaultTiles }: { tiles?: TileData[] }) {
  return (
    <div className="tile-grid">
      {tiles.map((tile) => (
        <Tile key={tile.index} {...tile} />
      ))}
    </div>
  );
}
