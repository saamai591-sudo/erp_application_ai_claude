CREATE    proc [PRM].[SpProductionAnalysisUpdate]
(
	@ProductionAnalysisID int,
	@Number int,
	@Date date,
	@Version int,
	@LastEditor int,
    @LastEditionDate datetime
)
--WITH ENCRYPTION
AS
BEGIN
	if @Number is null or @Number = 0
	set @Number = (select isnull(max(number),1) + 1 from [PRM].[ProductionAnalysis])

	update [PRM].[ProductionAnalysis]
	set			[Number] = @Number
			   ,[Date] = @Date
			   ,[Version] = [Version] + 1
			   ,[LastEditor] = @LastEditor
			   ,[LastEditionDate] = @LastEditionDate
	where [ProductionAnalysisID] = @ProductionAnalysisID

	select [Version], [Number]
	from [PRM].[ProductionAnalysis]
	where [ProductionAnalysisID] = @ProductionAnalysisID

end
