CREATE PROC [APT].[spPortionerInsert]
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @ApportionGroupID int,
	@ImportanceLevel decimal(20, 10),	
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF EXISTS (SELECT 1 FROM APT.Portioner WHERE Title = @Title)
	BEGIN
		RAISERROR('عنوان نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END  

	IF EXISTS (SELECT 1 FROM APT.Portioner WHERE Title2 = @Title2)
	BEGIN
		RAISERROR('عنوان2 نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END 

	declare @Code int, @Priority int

	set @Code =isnull((select MAX(Code) from APT.Portioner),0) + 1

	set @Priority =isnull((select MAX([Priority]) from APT.Portioner),0) + 1	

	INSERT INTO APT.Portioner(Code, Title, Title2, ApportionGroupID, ImportanceLevel, [Priority], Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @Code, @Title, @Title2, @ApportionGroupID, @ImportanceLevel, @Priority, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT PortionerID, [Version], Code, [Priority]
	FROM   APT.Portioner
	WHERE  PortionerID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
