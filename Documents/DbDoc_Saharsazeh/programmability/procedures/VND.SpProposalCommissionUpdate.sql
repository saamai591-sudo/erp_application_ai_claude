
CREATE     PROC [VND].[SpProposalCommissionUpdate]
    @ProposalCommissionID int,
    @FinancialPeriodID int,
    @Number int,
    @Date DATE,
    @PurchaseRequestID int,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@Status tinyint
--WITH ENCRYPTION
AS 

	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [VND].[ProposalCommission]
				where [ProposalCommissionID] = @ProposalCommissionID)
	begin
	RAISERROR('Version mismatch...', 16 , 10)
	return
	end


	set @Version = @Version +1 

		UPDATE [VND].[ProposalCommission]
		SET     [FinancialPeriodID] = @FinancialPeriodID, 
				[Number] = @Number, 
				[Date] = @Date, 
				[PurchaseRequestID] = @PurchaseRequestID, 
				[Description] = @Description, 
				[Description2] = @Description2, 
				[Creator] = @Creator, 
				[CreationDate] = @CreationDate, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version,
				Status = @Status
		WHERE  [ProposalCommissionID] = @ProposalCommissionID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [VND].[ProposalCommission]
		WHERE  [ProposalCommissionID] = @ProposalCommissionID	
		-- End Return Select <- do not remove
