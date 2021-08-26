export class Stack<T> {
    private values: T[] = []
    public push = (item: T) => {
        return this.values.push(item)
    }
    public pop = () => {
        return this.values.pop()
    }
    public peek = () => {
        if (this.values.length === 0)
            throw new Error('Stack is empty')
        return this.values[this.values.length - 1]
    }
    public isEmpty = () => {
        return this.values.length === 0
    }
    public size = () => {
        return this.values.length
    }
    public atIndex = (idx: number) => {
        return this.values[idx]
    }
}
