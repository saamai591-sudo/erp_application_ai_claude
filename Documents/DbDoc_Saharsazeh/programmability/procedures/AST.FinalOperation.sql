
-------------------------------------
CREATE   proc [AST].FinalOperation
(
	@FinancialPeriodID int,
	@BranchId int
)
--WITH ENCRYPTION 
AS 
set nocount on
BEGIN TRY

	declare @ErrorMessage nvarchar(max)

	if exists (select * from AST.AssetClosingOperation where FinancialPeriodID = @FinancialPeriodID and BranchID = @BranchId)
	begin
		declare @Title nvarchar(256)
		select @Title = Title from CFG.Branch where BranchID = @BranchId

		set @ErrorMessage = 'AssetManager.Messages.ClosedForTheBranch^'+@Title
		raiserror(@ErrorMessage, 16, 10)
		return
	end			

	DECLARE @EndDate Date,
			@StartDate date,
		    @EndDateString varchar(50),
		  	@Duration int,
			@UserID int,
			@CurrentDate DateTime,
			@ErrorTable NVARCHAR(400)

	set @UserID = cfg.GetuserID()
	set @CurrentDate = getdate()

	select @EndDate = EndDate,
		   @StartDate = startdate,
		   @Duration = DATEDIFF(day,StartDate,EndDate)
	from cfg.FinancialPeriod
	where FinancialPeriodID = @FinancialPeriodID

	set @EndDateString = cfg.GetSaturnDate(@EndDate,0)

	-- بررسی تخصیص بها به دارایی‌ها قبل از پایان دوره

	IF EXISTS (
		SELECT 1 
		FROM ast.Asset a
		LEFT JOIN ast.AssetSetting ast ON a.AssetID = ast.AssetID AND ast.ParentID IS NULL
		WHERE a.Status = 1 
			AND a.BranchID = @BranchId 
			AND a.AssetCreationDate <= @EndDate 
			AND (ast.AssetID IS NULL OR a.BaseValue = 0 OR a.BaseValue IS NULL)
	)
	BEGIN
		set @ErrorMessage = 'AssetManager.Messages.SomeAssetsHasNotBaseValue'
		RAISERROR(@ErrorMessage, 16, 12)
		RETURN
	END

	SET @ErrorTable = cfg.getTempTableName(1)

	 select 1
	from ast.DepreciationPeriod dp
	left join ast.DepreciationCalculation dc on dp.DepreciationPeriodID = dc.DepreciationPeriodID  and  dc.BranchID = @BranchId
	where dp.EndDate = @EndDate and
	dc.DepreciationCalculationID is null
	


	if exists ( select 1
	from ast.DepreciationPeriod dp
	left join ast.DepreciationCalculation dc on dp.DepreciationPeriodID = dc.DepreciationPeriodID  and  dc.BranchID = @BranchId
	where dp.EndDate = @EndDate and
	dc.DepreciationCalculationID is null
	)
	begin
		SET @ErrorMessage = N'AssetManager.Messages.NoDepCalcForUsingAssets^'+@EndDateString
		raiserror(@ErrorMessage,16,12)
		return
	end

	if exists (select 1 from ast.Sale
	where date between @StartDate and @EndDate
	and SaleStatus <> 2
)
begin
SET @ErrorMessage = N'AssetManager.Messages.SomeSaleAssetsNotConfirmed'
		raiserror(@ErrorMessage,16,12)
		return
end

	if exists (select 1 from ast.Transfer
	where date between @StartDate and @EndDate
	and TransferStatus <> 2
)
begin
SET @ErrorMessage = N'AssetManager.Messages.SomeTransferAssetsNotConfirmed'
		raiserror(@ErrorMessage,16,12)
		return
end

	if exists (select 1 from ast.Destruction
	where date between @StartDate and @EndDate
	and DestructionStatus <> 2
)
begin
SET @ErrorMessage = N'AssetManager.Messages.SomeDestructionAssetsNotConfirmed'
		raiserror(@ErrorMessage,16,12)
		return
end


	if exists (select 1 from ast.Salvage
	where date between @StartDate and @EndDate
	and SalvageStatus <> 2
)
begin
SET @ErrorMessage = N'AssetManager.Messages.SomeSalvageAssetsNotConfirmed'
		raiserror(@ErrorMessage,16,12)
		return
end



	if exists (
	select c.AssetReceiptID from ast.AssetReceipt c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	and c.date between @StartDate and  @EndDate and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.CreationNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
	select dc.DepreciationCalculationID from ast.DepreciationCalculation dc
	join ast.DepreciationPeriod dp on dc.DepreciationPeriodID = dp.DepreciationPeriodID
	where dp.FinancialPeriodID = @FinancialPeriodID and dc.BranchID = @BranchId
	
	and VoucherID is null)
	begin
		set @ErrorMessage = 'AssetManager.Messages.DepreciationNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
	select c.DestructionID 
	from ast.Destruction c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID  and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.DestructionNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
	select c.InsuranceID from ast.Insurance c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID  and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.InsuranceNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	
	if exists (
	select InsuranceSharingID from ast.InsuranceSharing ish
	join ast.AssetSetting [as] on [as].AssetSettingID = ish.AssetSettingID
	join ast.Asset a on a.AssetID = [as].AssetID
	where ish.FinancialPeriodID = @FinancialPeriodID
	and VoucherID is null  and a.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.InsuranceSharingNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end


	if exists (
	select c.RepairID from ast.Repair c
		join ast.Asset a on a.AssetID = c.AssetID
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID and a.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.RepairNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
	select c.RevaluationID from ast.Revaluation c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID  and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.RevaluationNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
	select c.SaleID from ast.Sale c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID  and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.SaleNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end


	if exists (
	select c.SalvageID from ast.Salvage c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID  and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.SalvageNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
	select c.AdjustmentID from ast.Adjustment c
	left join (
				select VoucherID,PrevoucherID from acc.VoucherPrevoucher
				group by VoucherID,PrevoucherID
	) vp on vp.PrevoucherID = c.PreVoucherID
	where (c.PreVoucherID is null or vp.VoucherID is null)
	 and c.FinancialPeriodID = @FinancialPeriodID  and c.BranchID = @BranchId)
	begin
		set @ErrorMessage = 'AssetManager.Messages.AdjustmentNotHaveVoucher'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	if exists (
			select OutgoingItemID
			from stc.Outgoing h
			join stc.OutgoingItem i on i.OutgoingID = h.OutgoingID
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			JOIN stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
			join stf.stock s on s.StockID = h.StockID
			where h.FinancialPeriodID = @FinancialPeriodID and s.BranchID = @BranchId
			and sdt.DocumentType = 8
			and i.OutgoingItemID not in (select isnull(OutgoingItemID,0) from ast.AssetReceiptItem where OutgoingItemID is not null)
			and i.OutgoingItemID not in (select OutgoingItemID from ast.RepairStuffCost)
			and i.OutgoingItemID not in (select OutgoingItemID from stc.ReturnedOutgoingItem)
			and i.OutgoingItemID not in (select OutgoingItemID from ast.AssetReceiptUtilizationCost)
			)
	begin
		set @ErrorMessage = 'AssetManager.Messages.OutgoingNotHaveCreation'
		raiserror(@ErrorMessage, 16, 10)
		return
	end

	INSERT INTO [AST].[AssetClosingOperation]
           ([FinancialPeriodID],
		    [BranchID]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
     VALUES
           (@FinancialPeriodID,
		   @BranchId,
           @userid,
           @CurrentDate,
           @userid,
           @CurrentDate,
           0)



END TRY
BEGIN CATCH

	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();

	
	RAISERROR (@ErrorMessage, -- Message text.
			   @ErrorSeverity, -- Severity.
			   @ErrorState -- State.
			   );
				   
END CATCH
