/** Parse a SUMO shape string like "x1,y1 x2,y2 x3,y3" into [[x1,y1],[x2,y2],...] */
export function parseShape(shape: string): number[][] {
    return shape.split(' ').map((coord) => coord.split(',').map(Number))
}
