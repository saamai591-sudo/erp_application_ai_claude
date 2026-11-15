
---------------------------------------------------------
CREATE   PROC [CTM].[SpReceptionTraceInsert] 
    @ReceptionID int,
    @Number int,
    @Date date,
    @PartyID bigint,
    @ReceptionStatusID int,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	
	IF (@Number is null) or @Number = 0
	    set @Number = isnull((select MAX(Number) from [CTM].[ReceptionTrace]),0) + 1
	
	INSERT INTO [CTM].[ReceptionTrace] ([ReceptionID], [Number], [Date], [PartyID], [ReceptionStatusID], [Description], [Description2], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ReceptionID, @Number, @Date, @PartyID, @ReceptionStatusID, @Description, @Description2, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ReceptionTraceID], [Version], [Number]
	FROM   [CTM].[ReceptionTrace]
	WHERE  [ReceptionTraceID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END;
