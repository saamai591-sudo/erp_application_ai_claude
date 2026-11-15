CREATE   PROC [FIN].[spCheqeBookInsert] 
    @BankAccountID int,
    @Seri nvarchar(100),
    @Number nvarchar(100),
    @Count tinyint,
    @ReportID int,
    @Status tinyint,
    @Creator int,
    @CreationDate datetime,
    @PrintDateToString BIT,
    @PrintNumberToWord BIT,
    @Perforage BIT,
    @Scratch BIT
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON

	IF EXISTS (SELECT 1 FROM FIN.CheqeBook c 
	           WHERE c.BankAccountID = @BankAccountID AND c.Seri = @Seri AND c.Number = @Number
			  )
	BEGIN
		DECLARE @Message NVARCHAR(MAX)
		set @Message = 'ترکیب حساب بانکی، سری و شماره نمی تواند تکراری باشد.'
		RAISERROR(@Message,16,12)		
	END 
	
	DECLARE @StartNumber nvarchar(100),@i int,@num int = NULL
	
	SET @StartNumber = @Number
	SET @i = 1
	
	WHILE @i <= @Count
	BEGIN
	
	INSERT INTO [FIN].[CheqeBook] ([BankAccountID], [Seri], [Number], [Count], [ReportID], [Status], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[PrintDateToString],[PrintNumberToWord],[Perforage],[Scratch])
	SELECT @BankAccountID, @Seri, @Number, @Count, @ReportID, @Status, 0, @Creator, @CreationDate, @Creator, @CreationDate,@PrintDateToString,@PrintNumberToWord,@Perforage,@Scratch
	
	SET @i = @i + 1
	
	SELECT @num = CONVERT(INT,@Number)
	SELECT @num = @num + 1
	SELECT @Number = REPLACE(@Number,LEFT(@Number,LEN(@Number)),CONVERT(nvarchar(100),@num))
	
	END
	
	SELECT [CheqeBookID], [Version], [Number]
	FROM   [FIN].[CheqeBook]
	WHERE  [BankAccountID] = @BankAccountID and [Seri] = @Seri and [Number] = @StartNumber
