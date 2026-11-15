
-----------------------------------
CREATE   PROCEDURE [PUM].[GetTicketAttachmentUserAcess]
(
    @FileAttachmentId int
)
AS
BEGIN
    select t.ExpertID,InternalUserID=t.Creator
    from CFG.FileAttachment fa
    join PUM.TicketAnswer ta on ta.TicketAnswerID=fa.EntityRelatedID
    join PUM.Ticket t on t.TicketID =  ta.TicketID
    join MDT.DmdEntity e on e.ID=fa.MetaDataEntityID
    where e.Name='TicketAnswer' and fa.FileAttachmentID = @FileAttachmentId

    Union 

    select t.ExpertID,InternalUserID=t.Creator
    from CFG.FileAttachment fa
    join PUM.Ticket t on t.TicketID=fa.EntityRelatedID    
    join MDT.DmdEntity e on e.ID=fa.MetaDataEntityID
    where e.Name='Ticket' and fa.FileAttachmentID = @FileAttachmentId
END
