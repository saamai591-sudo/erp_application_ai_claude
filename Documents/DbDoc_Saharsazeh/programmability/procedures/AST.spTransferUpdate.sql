
-------------------------------------
CREATE   PROC [AST].[spTransferUpdate] 
    @TransferID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @SourceBranchID int,
    @DestinationBranchID int,
    @Description nvarchar(250),
    @Description2 nvarchar(250),
    @PreVoucherID int,
	@TransferStatus tinyint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[Transfer]
	where [TransferID] = @TransferID)
	begin
		raiserror('Version mismatch...',16,10)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[Transfer]
	SET    [FinancialPeriodID] = @FinancialPeriodID, [Number] = @Number, [Date] = @Date, [SourceBranchID] = @SourceBranchID, [DestinationBranchID] = @DestinationBranchID, [Description] = @Description, [Description2] = @Description2, [PreVoucherID] = @PreVoucherID, [TransferStatus] = @TransferStatus, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [TransferID] = @TransferID
	
	-- Begin Return Select <- do not remove
	SELECT	[Version], 
			[Number]
	FROM   [AST].[Transfer]
	WHERE  [TransferID] = @TransferID	
	-- End Return Select <- do not remove
