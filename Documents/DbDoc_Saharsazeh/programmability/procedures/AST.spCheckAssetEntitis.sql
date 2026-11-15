------------------------------------- 
create   PROCEDURE [AST].[spCheckAssetEntitis]
(
@Entity varchar(50),
@EntityIDs varchar(max),
@Message varchar(100) output
)
AS
BEGIN

	select * 
	into #Ids
	from [CFG].[Split] (@EntityIDs,',')

	select AssetID, max(Date) Date
	into #Depreciations
	from AST.Depreciation
	group by AssetID

	declare @FinancialPeriodID int,
	        @BranchID int = null,
			@SourceBranchID int = null,
			@DestinationBranchID int = null

	if (@Entity = 'Adjustment')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.Adjustment
		where AdjustmentID in (select value from #Ids)

		if exists (select 1
		           from AST.AdjustmentItem i
				   join AST.Adjustment a on i.AdjustmentID = a.AdjustmentID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where a.Date <= d.Date and i.AdjustmentID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'ChangeCategory')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.ChangeCategory
		where ChangeCategoryID in (select value from #Ids)

		if exists (select 1
		           from AST.ChangeCategoryItem i
				   join AST.ChangeCategory c on i.ChangeCategoryID = c.ChangeCategoryID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where c.Date <= d.Date and i.ChangeCategoryID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'AssetReceipt')
	begin
		select @FinancialPeriodID = FinancialPeriodID,
			   @BranchID = BranchID
		from AST.AssetReceipt
		where AssetReceiptID in (select value from #Ids)

		if exists (select 1 from AST.Asset where AssetReceiptID in (select value from #Ids))
		begin
			set @Message = 'CreationsWithAssetsNotDeletable'	
			return		
		end
	end 

	if (@Entity = 'Destruction')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.Destruction
		where DestructionID in (select value from #Ids)

		if exists (select 1
		           from AST.DestructionItem i
				   join AST.Destruction a on i.DestructionID = a.DestructionID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where a.Date <= d.Date and i.DestructionID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Insurance')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.Insurance
		where InsuranceID in (select value from #Ids)

		if exists (select 1
		           from AST.InsuranceItem i
				   join AST.Insurance a on i.InsuranceID = a.InsuranceID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where a.Date <= d.Date and i.InsuranceID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Revaluation')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.Revaluation
		where RevaluationID in (select value from #Ids)

		if exists (select 1
		           from AST.RevaluationItem i
				   join AST.Revaluation a on i.RevaluationID = a.RevaluationID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where a.Date <= d.Date and i.RevaluationID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Sale')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.Sale
		where SaleID in (select value from #Ids)

		if exists (select 1
		           from AST.SaleItem i
				   join AST.Sale s on i.SaleID = s.SaleID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where s.Date <= d.Date and i.SaleID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Salvage')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @BranchID = BranchID
		from AST.Salvage
		where SalvageID in (select value from #Ids)

		if exists (select 1
		           from AST.SalvageItem i
				   join AST.Salvage s on i.SalvageID = s.SalvageID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where s.Date <= d.Date and i.SalvageID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Statement')
	begin

		select @FinancialPeriodID = FinancialPeriodID
		from AST.[Statement]
		where StatementID in (select value from #Ids)

		if exists (select 1
		           from AST.StatementItem i
				   join AST.[Statement] s on i.StatementID = s.StatementID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where s.Date <= d.Date and i.StatementID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Transfer')
	begin

		select @FinancialPeriodID = FinancialPeriodID,
		       @SourceBranchID = SourceBranchID,
			   @DestinationBranchID = DestinationBranchID
		from AST.[Transfer]
		where TransferID in (select value from #Ids)

		if exists (select 1
		           from AST.TransferItem i
				   join AST.[Transfer] t on i.TransferID = t.TransferID
		           join #Depreciations d on i.AssetID = d.AssetID
		           where t.Date <= d.Date and i.TransferID in (select value from #Ids))
		begin
			set @Message = 'AssetHasDepreciationCalculation' 
			return
		end

	end

	if (@Entity = 'Repair')
	begin

		if exists (select 1
		    from AST.Repair r
		    join #Depreciations d on r.AssetID = d.AssetID and r.Date <= d.Date
		    where r.Type = 2 and r.RepairID in (select value from #Ids))
		   begin
				set @Message = 'AssetHasDepreciationCalculation' 
				return
		   end

		select @FinancialPeriodID = FinancialPeriodID
		from AST.Repair
		where RepairID in (select value from #Ids)

	end


	
	if exists (select 1
		       from AST.AssetClosingOperation
		       where FinancialPeriodID = @FinancialPeriodID 
			   and
			         (
					 (@BranchID is not null and BranchID = @BranchID) 
					 or
					 (@SourceBranchID is not null and BranchID = @SourceBranchID) 
					 or
					 (@DestinationBranchID is not null and BranchID = @DestinationBranchID)
					 )
				)
	begin
		set @Message = 'AssetClosed' 
		return
	end

END
