CREATE   PROC [FIN].[spCheqeBookUpdate] 
    @CheqeBookID int,
    @BankAccountID int,
    @Seri nvarchar(100),
    @Number nvarchar(100),
    @Count tinyint,
    @ReportID int,
    @Status tinyint,
    @Version int,
    @LastEditor int,
    @LastEditionDate DATETIME,
    @PrintDateToString BIT,
    @PrintNumberToWord BIT,
    @Perforage BIT,
    @Scratch BIT
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [FIN].[CheqeBook]
	where [CheqeBookID] = @CheqeBookID)
		RAISERROR('Version mismatch...', 16 , 10)
	
		IF EXISTS (SELECT * FROM FIN.CheqeBook c 
		           WHERE c.BankAccountID = @BankAccountID AND c.Seri = @Seri AND c.Number = @Number
		           AND c.CheqeBookID <> @CheqeBookID)
		BEGIN
			DECLARE @Message NVARCHAR(MAX)			
			set @Message = 'ترکیب حساب بانکی، سری و شماره نمی تواند تکراری باشد.'
			RAISERROR(@Message,16,12)		
		END

		UPDATE [FIN].[CheqeBook]
		SET     [BankAccountID] = @BankAccountID, 
				[Seri] = @Seri, 
				[Number] = @Number, 
				[Count] = @Count, 
				[ReportID] = @ReportID, 
				[Status] = @Status, 
				[Version] = @Version + 1,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate,
				[PrintDateToString] = @PrintDateToString,
				[PrintNumberToWord] = @PrintNumberToWord,
				[Perforage] = @Perforage,
				[Scratch] = @Scratch
		WHERE  [CheqeBookID] = @CheqeBookID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FIN].[CheqeBook]
		WHERE  [CheqeBookID] = @CheqeBookID	
		-- End Return Select <- do not remove
