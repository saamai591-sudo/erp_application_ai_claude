CREATE PROCEDURE [CFG].[SpTrXmlLog] 
@TableName nvarchar(50),
@XmlInserted xml,
@XmlDeleted xml 

	--with encryption
AS

BEGIN

	SET NOCOUNT ON;
	
--IF db_Name() <> 'HR'
--RETURN 

	--**************************************************************************
	--IF object_id('tempDb.dbo.#Disabletriger') IS NOT NULL 
--		RETURN;
	--**************************************************************************
	
	
    DECLARE @OperationIn tinyint
    DECLARE @OperationDel tinyint
    DECLARE @OperationUp tinyint
    DECLARE @ModifiedDate smalldatetime 
    DECLARE @ComputerName nvarchar(50)
    DECLARE @UserId int
    

    SET @OperationIn=1
    SET @OperationDel=2
    SET @OperationUp=3
    SET @ModifiedDate=Getdate() 
    SET @ComputerName=cfg.GetComputerName()
    SET @UserId=cfg.GetUserId()


INSERT cfg.XMLLog
(
	TableName,
	Operation,
	ModifiedDate,
	ComputerName,
	UserId,
	XmlDatas
)
SELECT @TableName,@OperationIn,@ModifiedDate,@ComputerName,@UserId,@XmlInserted 
WHERE @XmlInserted IS NOT NULL AND @XmlDeleted IS NULL 


INSERT cfg.XMLLog
(
	TableName,
	Operation,
	ModifiedDate,
	ComputerName,
	UserId,
	XmlDatas
)
SELECT @TableName,@OperationDel,@ModifiedDate,@ComputerName,@UserId,@XmlDeleted 
WHERE @XmlDeleted IS NOT NULL  AND @XmlInserted IS NULL 

INSERT cfg.XMLLog
(
	TableName,
	Operation,
	ModifiedDate,
	ComputerName,
	UserId,
	XmlDatas,
	XmlDatasNew
)
SELECT @TableName,@OperationUp,@ModifiedDate,@ComputerName,@UserId,@XmlDeleted,@XmlInserted 
WHERE @XmlInserted IS NOT NULL AND @XmlDeleted IS NOT NULL  



END
