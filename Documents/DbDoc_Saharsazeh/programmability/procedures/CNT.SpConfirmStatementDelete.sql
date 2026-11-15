
CREATE    PROC [CNT].SpConfirmStatementDelete
    @ConfirmStatementID INT,
	@Version INT
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	DECLARE @CurrentVersion INT,
			@PrevoucherID  INT

	SELECT  @CurrentVersion = [Version] ,
			@PrevoucherID = PreVoucherID
	FROM [CNT].[ConfirmStatement]
	WHERE [ConfirmStatementID] = @ConfirmStatementID
	
    DECLARE @HasFlow BIT = (SELECT [CNT].[ConfirmStatementHasFlow](@ConfirmStatementID) )
    IF (@HasFlow = 1)
    BEGIN
        RAISERROR('HasFlowItemCanNotEdit', 16, 12);
        RETURN;
    END;

	if @Version=@CurrentVersion
	begin	


	IF @PrevoucherID IS NOT NULL
	BEGIN
		RAISERROR (N'این فرم دارای پیش نویس سند می باشد.', 
		16,
		12)
		RETURN
	END
		DELETE
		FROM   [CNT].[ConfirmStatement]
		WHERE  [ConfirmStatementID] = @ConfirmStatementID
	END
	ELSE
	BEGIN
	
		RAISERROR (N'Delete_%s_%d.', -- Message text.
			16, -- Severity,
			10, -- State,
			N'ConfirmStatement', -- First argument.
			@ConfirmStatementID); -- Second argument.)
	END;
