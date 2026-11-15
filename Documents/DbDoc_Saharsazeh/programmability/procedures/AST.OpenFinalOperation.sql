------------------------------------- 
CREATE   proc [AST].[OpenFinalOperation]
(
@financialPeriodId int,
@BranchId int
)
--WITH ENCRYPTION 
as

	declare @NextFinancialPeriod int,@EndDate date

	select @EndDate = EndDate from CFG.FinancialPeriod
	where FinancialPeriodID = @financialPeriodId

	select @NextFinancialPeriod = FinancialPeriodID from CFG.FinancialPeriod
	where StartDate = DATEADD(day,1,@EndDate)


if exists (select * from AST.Depreciation d
			join ast.Asset a on a.AssetID = d.AssetID
			 where d.FinancialPeriodID = @NextFinancialPeriod
			 and a.BranchID = @BranchId)
begin
raiserror(' در دوره مالی بعد محاسبه استهلاک انجام شده است.',16,13)
end

	delete from [AST].[AssetClosingOperation]
	where FinancialPeriodID = @financialPeriodId and BranchID = @BranchId

