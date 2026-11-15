CREATE     PROC [FIN].[spCashTransferUpdate]
    @CashTransferID INT,  	
    @Type TINYINT,
    @Date DATE,
	@BranchID INT,
	@SourceCashID INT,
	@TargetCashID INT,
	@Description NVARCHAR(256),
	@Description2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON
	
	if @Version=(Select [Version] from FIN.CashTransfer
	where CashTransferID = @CashTransferID)
	begin	
		set @Version = @Version +1 

		UPDATE FIN.CashTransfer
		SET    Type = @Type,
		       Date = @Date, 
			   BranchID = @BranchID, 
			   SourceCashID = @SourceCashID,
			   TargetCashID = @TargetCashID,
			   Description = @Description,
			   Description2 = @Description2,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  CashTransferID = @CashTransferID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],
			[Number]
		FROM   FIN.CashTransfer
		WHERE  CashTransferID = @CashTransferID	
		-- End Return Select <- do not remove
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
