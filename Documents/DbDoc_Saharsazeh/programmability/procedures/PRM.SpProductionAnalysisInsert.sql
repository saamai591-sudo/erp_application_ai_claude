CREATE   proc [PRM].[SpProductionAnalysisInsert]
(
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Creator int,
    @CreationDate datetime
)
--WITH ENCRYPTION
AS
BEGIN
    if @Number is null or @Number = 0
    set @Number = (select isnull(max(number),1) + 1 from [PRM].[ProductionAnalysis])

    INSERT INTO [PRM].[ProductionAnalysis]
           (FinancialPeriodID
		   ,[Number]
           ,[Date]
           ,[Version]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate])
     select
			@FinancialPeriodID
           ,@Number
           ,@Date
           ,0
           ,@Creator
           ,@CreationDate
           ,@Creator
           ,@CreationDate

    select [ProductionAnalysisID],[Version],[Number]
    from [PRM].[ProductionAnalysis]
    where [ProductionAnalysisID] = SCOPE_IDENTITY()
end
